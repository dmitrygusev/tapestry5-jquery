(function( $ ) {

$.extend(Tapestry, {
	/** 
     * Key for storing virtualScripts data in the DOM
     */
    VIRTUAL_SCRIPTS: 'tapestry.virtualScripts',
	
    waitForPage: function() {
        return;
    },
    
    onDOMLoaded: function(callback) {
        $(document).ready(callback);
    },
    
    init: function(specs) {
        $.each(specs, function(functionName, params) {
            var initf = Tapestry.Initializer[functionName];
            
            if (initf == undefined) {
                $().log("No Tapestry.Initializer function for : " + functionName);
            }
            
            $.each(params, function(i, paramList) {
            
                if (!jQuery.isArray(paramList)) {
                    paramList = [paramList];
                }
                
                initf.apply(this, paramList);
            });
        });
    },
    
    markScriptLibrariesLoaded: function(scripts) {
        var virtualScripts = $('html').data(Tapestry.VIRTUAL_SCRIPTS);
        $.each(scripts, function(i, script) {
            var complete = $.tapestry.utils.rebuildURL(script);
            virtualScripts.push(complete);
        });
        
        $('html').data(Tapestry.VIRTUAL_SCRIPTS, virtualScripts);
    }
});

/** Container of functions that may be invoked by the Tapestry.init() function. */
$.extend(Tapestry.Initializer, {
	
	/** Make the given field the active field (focus on the field). */
	activate : function(id) {
		$("#" + id).focus();
	},

    ajaxFormLoop: function(spec) {
    
        $.each(spec.addRowTriggers, function(index, triggerId) {
        
            $("#" + triggerId).click(function(event) {
                $("#" + spec.rowInjector).tapestryFormInjector("trigger");
                return false;
            })
        });
    },

	/**
	 * evalScript is a synonym for the JavaScript eval function. It is used in
	 * Ajax requests to handle any setup code that does not fit into a standard
	 * Tapestry.Initializer call.
	 */
	evalScript : function(spec) {

		eval(spec);
	},
    
	formEventManager : function(spec) {
		$("#" + spec.formId).formEventManager({
	       
            'form' : $('#' + spec.formId),
            'validateOnBlur' : spec.validate.blur,
            'validateOnSubmit' : spec.validate.submit

	    });
		
	},
    
    formInjector: function(spec) {
        $("#" + spec.element).tapestryFormInjector(spec);
    },
    
    formLoopRemoveLink: function(spec) {
        defaults = {
            effect: "blind"
        };
        
        spec = $.extend(defaults, spec);
        
        var link = $("#" + spec.link),
			fragmentId = spec.fragment;
        
        link.click(function(e) {
        
            var successHandler = function(data) {
            
                var container = $("#" + fragmentId),
					fragment = container.data("tapestry.formFragment");
                
                if (fragment != undefined) {
                    // TODO : reimplement fragment.hideAndRemove();
                }
                else {
                    var options = {};
                    container.hide(spec.effect, options, "normal", function() {
                        container.remove();
                    });
                }
            }
            
            $.ajax({
                url: spec.url,
                success: successHandler
            });
            
            return false;
        });
    },

    linkSubmit: function (spec) {
        $("#" + spec.clientId).tapestryLinkSubmit({
            form: spec.form
        });
    },

    /**
     * Convert a form or link into a trigger of an Ajax update that
     * updates the indicated Zone.
     * @param element id or instance of <form> or <a> element
     * @param zoneId id of the element to update when link clicked or form submitted
     * @param url absolute component event request URL
     */
    linkZone: function(spec) {
        var element = spec.linkId;
        var zoneId = spec.zoneId;
        var url = spec.url;
        var el = $('#' + element);

        if (el.is('form')) {
            el.submit(function() {
				var specs = {
					url : url,
					params: el.serialize()
				};

				$("#" + zoneId).tapestryZone("update", specs);

                return false;
            });
			
        } else if (el.is('select')) {
			
            el.change(function() {
                var parameters = {};
                var selectValue = $('#' + element + ' :selected').text();

                if (selectValue) {
                    parameters["t:selectvalue"] = selectValue;
                }

                $("#" + zoneId).tapestryZone("update" , {url : url, params : parameters});
                return false;
            });

		} else {
            el.click(function() {
                $("#" + zoneId).tapestryZone("update" , {url : url});
                return false;
            });
        }
    },
	
   /**
     * Converts a link into an Ajax update of a Zone. The url includes the
     * information to reconnect with the server-side Form.
     * 
     * @param spec.selectId
     *            id or instance of <select>
     * @param spec.zoneId
     *            id of element to update when select is changed
     * @param spec.url
     *            component event request URL
     */
    linkSelectToZone : function(spec) {
        Tapestry.Initializer.linkZone({ linkId : spec.selectId,
                                        zoneId : spec.zoneId,      
								        url : spec.url });
    },
    
    zone: function(spec) {
        if (!jQuery.isPlainObject(spec)) {
            spec = {
                element: spec
            };
        }
        
        $('#' + spec.element).tapestryZone(spec);
    }
    
});

/**
 * Zone plugin
 * @param {Object} options
 */
$.widget( "ui.tapestryZone", {
	options: {
    	show: "highlight",
    	update: "highlight"
	},

	_create: function() {
		this.element
			.addClass( "tapestry-zone" )
	},

	destroy: function() {
		this.element
			.removeClass( "tapestry-zone");
		
		$.Widget.prototype.destroy.apply( this, arguments );
	},

    /**
     * Refresh a zone
     * @zoneId
     * @url to request
     * @params optional, can contain data. Request will switch from GET to POST
     */
    update: function(specs) {
        
		var that = this;
		
        var ajaxRequest = {
            url: specs.url,
            success: function(data) {
                
				if (data.content) {

	                that.applyContentUpdate(data.content);

				} else if (data.zones) {

                    // perform multi zone update
					$.each(data.zones, function(zoneId){

						$('#' + zoneId).tapestryZone("applyContentUpdate", data.zones[zoneId]);
					});
					
				}

                $.tapestry.utils.loadScriptsInReply(data);
            }
        };
        
        if (specs.params) {
            ajaxRequest = $.extend(ajaxRequest, {
                type: 'post',
                data: specs.params
            });
        }
        
        $.ajax(ajaxRequest);
    }, 
	
	/**
	 * Updates the element's content and triggers the appropriate effect on the
	 * zone.
	 * 
	 * @param {Object} content the new content for this zone's body
	 */
	applyContentUpdate: function(content) {

		if (content === undefined) {

			console.log("WARN: content is undefined. Aborting update for zone: " + this.element.attr("id"));
			return;
		}

		var el = this.element;
		var effect = el.is(":visible") ? this.options.update : this.options.show;

		el.html(content).effect(effect);
	}
	
});

$.widget( "ui.tapestryLinkSubmit", {
    options: {
    },

    _create: function() {
        this.form = $("#" + this.options.form);
        
        this.element.click(function() {
            $(this).tapestryLinkSubmit("clicked");

            return false;
        });
    },

    destroy: function() {
        this.element
            .removeClass( "tapestry-palette");
        
        $.Widget.prototype.destroy.apply( this, arguments );
    },
        
    _createHidden: function () {    
        var hidden = $("<input></input>").attr({ "type":"hidden",
            "name": this.element.id + ":hidden",
            "value": this.element.id});
    
        this.element.after(hidden);
    },
    
    clicked: function() {
        var onsubmit = this.form.get(0).onsubmit;

        this._createHidden();

        this.form.get(0).submit();  
    }
});

$.widget("ui.formEventManager", {
    options: { },

    _create: function() { 
	
	},

    /**
     * Identifies in the form what is the cause of the submission. The element's
     * id is stored into the t:submit hidden field (created as needed).
     * 
     * @param element
     *            id or element that is the cause of the submit (a Submit or
     *            LinkSubmit)
     */
    setSubmittingElement : function(element) {

        var form = this.options.form;

		if (!form.submitHidden) {

            // skip if this is not a tapestry controlled form
			var hasNoFormData = true;
			$(form).find('input[type="hidden"][name="t:formdata"]').each(function(){
                hasNoFormData = $.isEmptyObject( $(this).attr('value'));
			});

            if (hasNoFormData) {
				return;
			}

            var hiddens = $(form).find('input[type="hidden"][name="t:submit"]');

            if (hiddens.size() === 0) {

                /**
                 * Create a new hidden field directly after the first hidden
                 * field in the form.
                 */
                $(hiddens[0]).after('<input type="hidden" name="t:submit"');

            } else
                form.submitHidden = hiddens.first();
        }

        this.submitHidden.value = element == null ? null : $(element).id;
    }
	
});

/**
 * Form Injector
 */
$.widget( "ui.tapestryFormInjector", {
	options: {
    	show: "highlight"
	},

	_create: function() {
		this.element
			.addClass( "tapestry-forminjector" )
	},

	destroy: function() {
		this.element
			.removeClass( "tapestry-forminjector");
		
		$.Widget.prototype.destroy.apply( this, arguments );
	},

    trigger: function() {
		var that = this,
			el = $("#" + this.options.element);
		
        var successHandler = function(data) {
        	$(data).log("data");	
            $.tapestry.utils.loadScriptsInReply(data, function() {
                // Clone the FormInjector element (usually a div)
                // to create the new element, that gets inserted
                // before or after the FormInjector's element.				
                var newElement = el.clone().attr("id", data.elementId).html(data.content);
                
                newElement = that.options.below ? el.after(newElement) : el.before(newElement);
                
                newElement.effect(that.options.show);
            });
            
        };
        $(this.options).log("this.options.url" + this.options.url)
        $.ajax({
            url: this.options.url,
            success: successHandler
        });
    }
});


/**
 * Logger based on console
 */
jQuery.fn.log = function(msg) {
    if (Tapestry.DEBUG_ENABLED && typeof console != "undefined" && typeof console.log != "undefined") 
        console.log("%s: %o", msg, this);
    
    return this;
};

/**
 * Tapestry static functions
 */
$.tapestry = {
    utils: {
        /**
         * Used to reconstruct a complete URL from a path that is (or may be) relative to window.location.
         * This is used when determining if a JavaScript library or CSS stylesheet has already been loaded.
         * Recognizes complete URLs (which are returned unchanged), otherwise the URLs are expected to be
         * absolute paths.
         *
         * @param path
         * @return complete URL as string
         */
        rebuildURL: function(path) {
            if (path.match(/^https?:/)) {
                return path;
            }
            
            if (path.indexOf("/") !== 0) {
                $(this).log(Tapestry.Messages.pathDoesNotStartWithSlash + " " + path);
                
                return path;
            }
            
            var l = window.location;
            return l.protocol + "//" + l.host + path;
        },
        
        /**
         * Add scripts, as needed, to the document, then waits for them all to load, and finally, calls
         * the callback function.
         * @param scripts Array of scripts to load
         * @param callback invoked after scripts are loaded
         */
        addScripts: function(scripts, callback) {
            if (scripts) {
            
                $.each(scripts, function(i, s) {
                    var assetURL = $.tapestry.utils.rebuildURL(s);
                    var virtualScripts = $('html').data(Tapestry.VIRTUAL_SCRIPTS);
                    
                    if (virtualScripts == undefined) {
                        virtualScripts = [];
                        
                        $('script[src]').each(function(i, script) {
                            path = $(script).attr('src');
                            virtualScripts.push($.tapestry.utils.rebuildURL(path));
                        });
                    }
                    
                    if ($.inArray(assetURL, virtualScripts) == -1) {
                        $('head').append('<script src="' + assetURL + '" type="text/javascript" />');
                        virtualScripts.push(assetURL);
                    }
                    
                    $('html').data(Tapestry.VIRTUAL_SCRIPTS, virtualScripts);
                });
                
            }
            
            // TODO : re-implement scriptLoadMonitor
            callback.call(this);
        },
        
        addStylesheets: function(stylesheets) {
            if (stylesheets) {
                $.each(stylesheets, function(i, s) {
                    var assetURL = $.tapestry.utils.rebuildURL(s.href);
                    
                    if ($('head link[href="' + assetURL + '"]').size() == 0) {
                    
                        stylesheet = '<link href="' + assetURL + '" type="text/css" rel="stylesheet"';
                        
                        if (s.media != undefined) 
                            stylesheet += ' media="' + s.media + '" ';
                        
                        stylesheet += '/>';
                        
                        $('head').append(stylesheet);
                    }
                });
            }
        },
        
        /**
         * Passed the JSON content of a Tapestry partial markup response, extracts
         * the script and stylesheet information.  JavaScript libraries and stylesheets are loaded,
         * then the callback is invoked.  All three keys are optional:
         * <dl>
         * <dt>redirectURL</dt> <dd>URL to redirect to (in which case, the callback is not invoked)</dd>
         * <dt>scripts</dt><dd>Array of strings (URIs of scripts)</dd>
         * <dt>stylesheets</dt><dd>Array of hashes, each hash has key href and optional key media</dd>
         *
         * @param reply JSON response object from the server
         * @param callback function invoked after the scripts have all loaded (presumably, to update the DOM)
         */
        loadScriptsInReply: function(reply, callback) {
            var redirectURL = reply.redirectURL;
            
            if (redirectURL) {
                // Check for complete URL.
                if (/^https?:/.test(redirectURL)) {
                    window.location = redirectURL;
                    return;
                }
                
                window.location.pathname = redirectURL;
                
                // Don't bother loading scripts or invoking the callback.
                return;
            }
            
            $.tapestry.utils.addStylesheets(reply.stylesheets);
            
            $.tapestry.utils.addScripts(reply.scripts, function() {
                
				/* Let the caller do its thing first (i.e., modify the DOM). */
				if (callback) {
					callback.call(this);
				}

	            /* And handle the scripts after the DOM is updated. */
                if (reply.inits) {
	               $.tapestry.utils.executeInits(reply.inits);
				}					
                
            });
        },
		
	    /**
	     * Called from Tapestry.loadScriptsInReply to load any initializations from
	     * the Ajax partial page render response. Calls
	     * Tapestry.onDomLoadedCallback() last. This logic must be deferred until
	     * after the DOM is fully updated, as initialization often refer to DOM
	     * elements.
	     * 
	     * @param initializations
	     *            array of parameters to pass to Tapestry.init(), one invocation
	     *            per element (may be null)
	     */
	    executeInits : function(initializations) {

	        var initArray = $(initializations).toArray();

	        $(initArray).each(function(index) {

	            Tapestry.init(initArray[index]);
	        });
	    }

    }
};
    
})(jQuery);
