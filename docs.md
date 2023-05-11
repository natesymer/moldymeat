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

## Functions

<dl>
<dt><a href="#diff">diff(lhs, rhs)</a> ⇒ <code><a href="#Diff">Diff</a></code></dt>
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
    * [~boolPrompt(q)](#module_util..boolPrompt)

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

<a name="module_util..boolPrompt"></a>

### util~boolPrompt(q)
Prompts the user for a yes/no answer via CLI.

**Kind**: inner method of [<code>util</code>](#module_util)  

| Param | Type | Description |
| --- | --- | --- |
| q | <code>string</code> | The prompt to use. |

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
    * [.updateSchema(options)](#MoldyMeat+updateSchema)

<a name="new_MoldyMeat_new"></a>

### new MoldyMeat(options)
Create a MoldyMeat instance.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> |  |
| options.sequelize | <code>Sequelize</code> | The sequelize instance to use. |
| options.hintsFile | <code>string</code> | The file path to the hints file |
| options.hitns | <code>string</code> | Hints to use instead of loading them from a file. |

<a name="MoldyMeat+initialize"></a>

### moldyMeat.initialize() ⇒ [<code>MoldyMeat</code>](#MoldyMeat)
Initializes MoldyMeat. Must be called before calling other methods.

**Kind**: instance method of [<code>MoldyMeat</code>](#MoldyMeat)  
**Returns**: [<code>MoldyMeat</code>](#MoldyMeat) - Returns a reference to this for convenience  
<a name="MoldyMeat+updateSchema"></a>

### moldyMeat.updateSchema(options)
Updates the schema of the database (to which sequelize is connected) to match the
models in `this.sequelize.models`

**Kind**: instance method of [<code>MoldyMeat</code>](#MoldyMeat)  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> |  |
| options.forward | <code>bool</code> | Runs the DB updates forward if true, backwards one update if false |
| options.generateHints | <code>bool</code> | Generates hints if true. Note: Requires an interactive shell if true |
| options.useHints | <code>bool</code> | Whether or not to use hints. |

<a name="diff"></a>

## diff(lhs, rhs) ⇒ [<code>Diff</code>](#Diff)
Returns the difference between `lhs` and `rhs`.

**Kind**: global function  
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

