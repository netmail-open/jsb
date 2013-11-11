jsb
===

json-schema builder: A simple javascript based form generator based on json-schema


Example
=======

<div id="form"></div>

<script>
	var f	= document.getElementById('form');
	var jsb	= new JSB(f, {
		"name":		"bob",
		"age":		30
	});

	jsb.setSchema({
		"properties": {
			"name": {
				"type":	"string",
			},
			"age": {
				"type":	"number",
			}
		}
	});

	jsb.render();
</script>


