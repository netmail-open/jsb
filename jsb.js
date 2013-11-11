var JSB = function(element, data)
{
	this.nextid	= 1;

	this.element	= element;
	this.data		= data;
	this.iddata		= {};
};

JSB.prototype.setSchema = function(schema, loadSchemaCB)
{
	this.schema		= this.fixupSchema(schema);
	this.schemaCB	= loadSchemaCB;
};

JSB.prototype.uniqueName = function()
{
	return('jsb_' + (++this.nextid));
};

JSB.prototype.hasClass = function(el, name)
{
	return new RegExp('(\\s|^)'+name+'(\\s|$)').test(el.className);
};

JSB.prototype.addClass = function(el, name)
{
	if (!this.hasClass(el, name)) {
		el.className += (el.className ? ' ' : '') +name;
	}
};

JSB.prototype.removeClass = function(el, name)
{
	if (this.hasClass(el, name)) {
		el.className = el.className.replace(new RegExp('(\\s|^)'+name+'(\\s|$)'),' ').replace(/^\s+|\s+$/g, '');
	}
};

JSB.prototype.mergeSchema = function(a, b)
{
	for (var p in b) {
		try {
			if (b[p].constructor == Object) {
				a[p] = this.mergeSchema(a[p], b[p]);
			} else {
				a[p] = b[p];
			}
		} catch(e) {
			a[p] = b[p];
		}
	}

	return(a);
};

JSB.prototype.fixupSchema = function(schema)
{
	if (!this.schemaCB) {
		/* We can't do much if we can't load more schema */
		return(schema);
	}

	if (!schema.type) {
		if (schema.items) {
			schema.type = 'array';
		} else if (schema.properties) {
			schema.type = 'object';
		}
	}

	if (schema && schema['$ref']) {
		schema = this.schemaCB(schema['$ref']);
	}

	/* Clone the object so we don't mess with the original */
	schema = JSON.parse(JSON.stringify(schema));

	var extendlist	= [];

	switch (typeof schema['extends']) {
		case 'string':
			extendlist = [ schema['extends'] ];
			break;

		case 'object':
			extendlist = schema['extends'];
			break;
	}
	delete schema['extends'];

	for (var i = 0, e; e = extendlist[i]; i++) {
		var supero;
		var nschema	= {};

		if (!(supero = this.schemaCB(e))) {
			continue;
		}

		schema = this.mergeSchema(schema, supero);
	}

	return(schema);
};

JSB.prototype.renderHTML = function(schema, name, data, options)
{
	var id = this.uniqueName();

	schema = this.fixupSchema(schema);

	this.iddata[id] = {
		schema:		schema,
		name:		name
	};

	options	= options || {};

	var html	= '';
	var value;
	var title	= schema.title || name;
	var type;

	switch (typeof schema.type) {
		case 'string':
			type = schema.type;
			break;

		case 'undefined':
			type = 'object';
			break;

		case 'object':
			/*
				If an array of types was given assume that the last is the best
				choice. Why did I chose this? It seemed to work with the common
				case of:
					[ 'string', 'array' ]
			*/
			type = schema.type[schema.type.length - 1];
			break;
	}
	this.iddata[id].type = type;

	if (title && title.length > 0) {
		html += '<label>';
		html += htmlEncode(
			title.charAt(0).toUpperCase() + title.slice(1)
		);

		html += ':';
		html += '</label>';
	}

	if (schema['enum']) {
		html += '<select name="' + id + '">\n';

		if (!schema.required) {
			/* Insert a blank item; this field isn't required */
			html += '<option></option>';
		}

		for (var i = 0, e; e = schema['enum'][i]; i++) {
			html += '<option';

			if (data && data === e) {
				html += ' selected';
			}

			html += '>' + e + '</option>';
		}

		html += '</select><br/>\n';
	} else {
		switch (type) {
			case 'string':
			case 'number':
			case 'integer':
				html += '<input name="' + id + '" type="text" class="' + type + '"';

				if (data) {
					html += ' value="' + htmlEncode(data) + '"';
				}

				html += '/>\n';
				html += '<br />\n';
				break;

			case 'boolean':
				html += '<input name="' + id + '" type="checkbox" class="' + type + '"';

				if (data) {
					html += ' checked';
				}

				html += '/>\n';
				html += '<br />\n';
				break;

			case 'array':
				var item;

				if ((item = schema.items)) {
					this.iddata[id].action	= 'add';
					this.iddata[id].item	= item;

					html += '<span class="' + id + ' ' + type + '">';
					html += '<button name="' + id + '">+</button>';

					if (data) {
						html += '<fieldset>';
						for (var i = 0; i < data.length; i++) {
							html += '<span>';
							html += this.insertArrayItem(item, data[i]);
							html += '</span>';
						}
						html += '</fieldset>';
					}

					html += '</span><br/>';
				}
				break;

			case 'object':
				if (schema.properties) {
					/* A normal object */
					var properties	= Object.keys(schema.properties);

					html += '<fieldset name="' + id + '" class="' + type + '">\n';

					for (var i = 0, p; p = schema.properties[properties[i]]; i++) {
						html += this.renderHTML(p, properties[i], (data || {})[properties[i]], options);
					}
					html += '</fieldset>\n';
				} if ((item = schema.patternProperties)) {
					// TODO	Write me
					html = '';
				}
				break;
		}
	}

	return(html);
};

JSB.prototype.insertArrayItem = function(item, data, options)
{
	var id		= this.uniqueName();
	var html	= '';

	html += '<button style="float: right;" name="' + id + '">X</button>';

	html += this.renderHTML(item, null, data, options);

	this.iddata[id] = {
		schema:		item,
		data:		null,
		action:		'del'
	};

	return(html);
};

JSB.prototype.render = function(options)
{
	var html = this.renderHTML(this.schema, null, this.data, options || {});

	// console.log(html);

	this.element.innerHTML = html;
	this.element.addEventListener('click', function(e) {
		var detail;
		var target;

		if (!e || !(target = e.toElement) ||
			!(detail = this.getDetail(target))
		) {
			return;
		}

		switch (detail.action) {
			case 'add':
				var container;
				var item;

				if ((container = target.parentNode) &&
					(container = container.getElementsByTagName('fieldset'))
				) {
					container = container[0];
				}

				if (!container && (container = document.createElement('fieldset'))) {
					if (target.nextSibling) {
						target.parentNode.insertBefore(container, target.nextSibling);
					} else {
						target.parentNode.appendChild(container);
					}
				}

				if (container) {
					var span	= document.createElement('span');

					span.innerHTML = this.insertArrayItem(detail.item, detail.data, options);
					container.appendChild(span);
				}
				this.validate(container);

				break;

			case 'del':
				var container;
				var p;

				if (detail && target && (container = target.parentNode)) {
					p = container.parentNode;

					p.removeChild(container);

					if (!p.firstChild) {
						p.parentNode.removeChild(p);
					}
				}
				break;
		}
	}.bind(this));

	this.element.addEventListener('change', function(e) {
		this.validate(e.target);
	}.bind(this));

	this.validate();
	this.addClass(this.element, 'jsb');
};

JSB.prototype.getDetail = function(el)
{
	if (!el) {
		return(null);
	}

	if (el.name) {
		return(this.iddata[el.name]);
	}

	if (el.className) {
		var classes = el.className.split(' ');

		for (var i = 0, c; c = classes[i]; i++) {
			if (0 == c.indexOf('jsb_')) {
				return(this.iddata[c]);
			}
		}
	}

	return(null);
};

JSB.prototype.getValue = function(element)
{
	var value	= undefined;
	var detail	= null;

	switch (element.nodeName.toLowerCase()) {
		case 'button':
			return(null);
	}

	detail = this.getDetail(element);

	if (detail && detail.schema) {
		switch (detail.type) {
			case 'object':
				value = {};

				for (var i = 0, n; n = element.childNodes[i]; i++) {
					var v;
					var d;

					if (!(d = this.getDetail(n)) || !d.name) {
						continue;
					}

					if ((v = this.getValue(n))) {
						value[d.name] = v;
					}
				}
				return(value);

			case 'array':
				var fieldset = null;

				if (!isNaN(detail.schema.minItems) &&
					detail.schema.minItems > 0
				) {
					/* Always include an array that requires items */
					value = [];
				}

				for (var i = 0, n; n = element.childNodes[i]; i++) {
					if (n.nodeName.toLowerCase() == 'fieldset') {
						fieldset = n;
						break;
					}
				}

				if (fieldset) {
					for (var i = 0, n; n = fieldset.childNodes[i]; i++) {
						var v;

						if ((v = this.getValue(n))) {
							if (!value) {
								value = [];
							}

							value.push(v);
						}
					}
				}

				return(value);
		}
	}

	switch (element.nodeName.toLowerCase()) {
		default:
			/* Get the first child's value */
			for (var i = 0, n; n = element.childNodes[i]; i++) {
				if ((value = this.getValue(n))) {
					break;
				}
			}
			break;

		case 'input':
			if (!detail) break;

			switch (detail.type) {
				case 'string':
					if (element.value && element.value.length > 0) {
						value = element.value;
					}
					break;

				case 'number':
				case 'integer':
					value = parseInt(element.value);

					if (isNaN(value)) {
						value = undefined;
					}
					break;

				case 'boolean':
					value = element.checked;
					break;
			}
			break;

		case 'select':
			if (!detail) break;

			if (detail.schema.required || element.selectedIndex > 0) {
				value = element.options[element.selectedIndex].value;
			}
			break;
	}

	return(value);
};

JSB.prototype.validate = function(el)
{
	var detail;
	var valid	= true;

	if (!el && tv4) {
		/*
			If tv4 is present then validate the whole document in one go as well
			as doing the individual items for the sake of highlighting.
		*/
		this.schema = this.fixupSchema(this.schema);
		valid = tv4.validate(this.getValue(this.element), this.schema, true, true);

		if (!valid) {
			console.log(tv4.error);
		}
	}

	if (!(el = el || this.element)) {
		return(true);
	}
	this.removeClass(el, 'invalid');

	if (!el.childNodes || el.childNodes.length == 0) {
		if ((detail = this.getDetail(el))) {
			if (tv4) {
				/* Use tv4 if loaded */
				if (!tv4.validate(this.getValue(el), detail.schema)) {
					// console.log(tv4.error);

					this.addClass(el, 'invalid');
					return(false);
				}
			} else if (detail.schema.required) {
				/* Very simple built in validation */

				if (!el.value || el.value.length == 0) {
					this.addClass(el, 'invalid');
					return(false);
				}
			}
		}
	} else {
		for (var i = 0, n; n = el.childNodes[i]; i++) {
			if (!this.validate(n)) {
				valid = false;
			}
		}
	}

	return(valid);
};

JSB.prototype.toJSON = function()
{
	return(this.getValue(this.element));
};

