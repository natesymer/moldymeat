## Modules

<dl>
<dt><a href="#module_util">util</a></dt>
<dd></dd>
</dl>

## Classes

<dl>
<dt><a href="#MoldyMeat">MoldyMeat</a></dt>
<dd><p>The main moldymeat class.</p>
</dd>
</dl>

## Members

<dl>
<dt><a href="#diff">diff</a> ⇒ <code><a href="#Diff">Diff</a></code></dt>
<dd><p>Returns the difference between <code>lhs</code> and <code>rhs</code>.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#Diff">Diff</a> : <code>object</code></dt>
<dd></dd>
</dl>

<a name="module_util"></a>

## util

* [util](#module_util)
    * [~removeUndefined(obj)](#module_util..removeUndefined) ⇒ <code>object</code>
    * [~objectMap(obj, fn)](#module_util..objectMap) ⇒ <code>object</code>

<a name="module_util..removeUndefined"></a>

### util~removeUndefined(obj) ⇒ <code>object</code>
Deeply removes any `undefined` properties on obj, mutating obj.

**Kind**: inner method of [<code>util</code>](#module_util)  
**Returns**: <code>object</code> - Returns obj after mutations, for convenience's sake.  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>object</code> | The object to remove `undefined`s from. |

<a name="module_util..objectMap"></a>

### util~objectMap(obj, fn) ⇒ <code>object</code>
Maps the function fn over obj's entries, returning an object.

**Kind**: inner method of [<code>util</code>](#module_util)  
**Returns**: <code>object</code> - An object built from mapping fn over obj's entries.  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>object</code> | Any object |
| fn | <code>function</code> | Takes an entry, returns an entry |

<a name="MoldyMeat"></a>

## MoldyMeat
The main moldymeat class.

**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| sequelize | <code>Sequelize</code> | The underlying Sequelize instance. |
| stateModel | <code>Sequelize.Model</code> | The model for schema updates |


* [MoldyMeat](#MoldyMeat)
    * [new MoldyMeat(options)](#new_MoldyMeat_new)
    * [.initialize()](#MoldyMeat+initialize) ⇒ [<code>MoldyMeat</code>](#MoldyMeat)
    * [.updateSchema()](#MoldyMeat+updateSchema)

<a name="new_MoldyMeat_new"></a>

### new MoldyMeat(options)
Create a MoldyMeat instance.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> |  |
| options.sequelize | <code>Sequelize</code> | The sequelize instance to use. |

<a name="MoldyMeat+initialize"></a>

### moldyMeat.initialize() ⇒ [<code>MoldyMeat</code>](#MoldyMeat)
Initializes MoldyMeat. Must be called before calling other methods.

**Kind**: instance method of [<code>MoldyMeat</code>](#MoldyMeat)  
**Returns**: [<code>MoldyMeat</code>](#MoldyMeat) - Returns a reference to this for convenience  
<a name="MoldyMeat+updateSchema"></a>

### moldyMeat.updateSchema()
Updates the schema of the database (to which sequelize is connected) to match the
models in `this.sequelize.models`

**Kind**: instance method of [<code>MoldyMeat</code>](#MoldyMeat)  
<a name="diff"></a>

## diff ⇒ [<code>Diff</code>](#Diff)
Returns the difference between `lhs` and `rhs`.

**Kind**: global variable  
**Returns**: [<code>Diff</code>](#Diff) - The difference between `lhs` and `rhs`.  

| Param | Type |
| --- | --- |
| lhs | <code>object</code> | 
| rhs | <code>object</code> | 

<a name="Diff"></a>

## Diff : <code>object</code>
**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| added | <code>object</code> | 
| deleted | <code>object</code> | 
| updated | <code>object</code> | 

