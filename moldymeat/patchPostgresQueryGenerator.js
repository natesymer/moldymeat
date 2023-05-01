

function patchPostgresQueryGenerator(queryGenerator) {
  // patch sequelize because it uses serial
  // see the following:
  // https://github.com/sequelize/sequelize/pull/14687
  // https://github.com/sequelize/sequelize/issues/15753
  queryGenerator.changeColumnQuery = function(tableName, attributes) {
    const query = subQuery => `ALTER TABLE ${this.quoteTable(tableName)} ALTER COLUMN ${subQuery};`;
    const sql = [];
    for (const attributeName in attributes) {
      let definition = this.dataTypeMapping(tableName, attributeName, attributes[attributeName]);
      let attrSql = '';

	// START: expand SERIAL back into its real definition.
      if (definition.includes('SERIAL')) {
		if (definition.includes('BIGSERIAL')) {
			definition = definition.replace('BIGSERIAL', 'BIGINT');
		} else if (definition.includes('SMALLSERIAL')) {
			definition = definition.replace("SMALLSERIAL", 'SMALLINT');
		} else {
			definition = definition.replace('SERIAL', 'INTEGER');
		}
		definition += ` DEFAULT nextval(format('%I', '${tableName}_${attributeName}_seq'))`;
		if (attributes[attributeName].includes('NOT NULL')) {
			definition += ' NOT NULL';
		}
      }
	// END: expand SERIAL back into its real definition

      if (definition.includes('NOT NULL')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} SET NOT NULL`);

        definition = definition.replace('NOT NULL', '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} DROP NOT NULL`);
      }

      if (definition.includes('DEFAULT')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} SET DEFAULT ${definition.match(/DEFAULT ([^;]+)/)[1]}`);

        definition = definition.replace(/(DEFAULT[^;]+)/, '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} DROP DEFAULT`);
      }

      if (attributes[attributeName].startsWith('ENUM(')) {
        attrSql += this.pgEnum(tableName, attributeName, attributes[attributeName]);
        definition = definition.replace(/^ENUM\(.+\)/, this.pgEnumName(tableName, attributeName, { schema: false }));
        definition += ` USING (${this.quoteIdentifier(attributeName)}::${this.pgEnumName(tableName, attributeName)})`;
      }

      if (/UNIQUE;*$/.test(definition)) {
        definition = definition.replace(/UNIQUE;*$/, '');
        attrSql += query(`ADD UNIQUE (${this.quoteIdentifier(attributeName)})`).replace('ALTER COLUMN', '');
      }

      if (definition.includes('REFERENCES')) {
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        attrSql += query(`ADD FOREIGN KEY (${this.quoteIdentifier(attributeName)}) ${definition}`).replace('ALTER COLUMN', '');
      } else {
        attrSql += query(`${this.quoteIdentifier(attributeName)} TYPE ${definition}`);
      }

      sql.push(attrSql);
    }

    return sql.join('');
  }
}

module.exports = patchPostgresQueryGenerator;
