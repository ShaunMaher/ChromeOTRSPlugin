function otrs_ticket (ticket_id) {
	this.ticket_id = ticket_id;
	this.ticket_number = 0;
	this.has_metadata = 0;
	this.age = 0;
	this.state_id = 0;
	this.state = ''
	this.type_id = 0;
	this.type_name = 0;
	this.owner_id = 0;
	this.title = '';
	this.priority = '';
	this.queue = '';
}

function otrs_queue (name) {
	this.name = name;
	this.tickets = {};
	this.ticket_ids = [];
	
	this.loaded = function() {
		var ticket_ids_without_metadata = this.get_ticket_ids_without_metadata();
		if (ticket_ids_without_metadata.length > 0) {
			return 0;
		}
		else {
			return 1;
		}
	}
	
	this.set_ticket_ids = function(new_ticket_ids) {
		//TODO: Find the tickets that are in our local list but not in the new list and delete them
		for (var index = 0; index < this.ticket_ids.length; index++) {
			if (new_ticket_ids.indexOf(this.ticket_ids[index]) < 0) {
				//nothing to do
			}
			else {
				delete this.ticket_ids[index];
				console.log("otrs_queue(" + this.name + ").set_ticket_ids(): Info: Ticket deleted from cache: " + index);
			}
		}
		
		//Find the tickets in the new list and are not in our local list and insert them.
		for (var index = 0; index < new_ticket_ids.length; index++) {
			if (this.ticket_ids.indexOf(new_ticket_ids[index]) < 0) {
				console.log("otrs_queue(" + this.name + ").set_ticket_ids(): New ticket: " + new_ticket_ids[index]);
				this.ticket_ids.push(new_ticket_ids[index]);
				this.tickets[new_ticket_ids[index]] = new otrs_ticket(new_ticket_ids[index]);
			}
		}
	}
	
	this.get_ticket_ids_without_metadata = function() {
		var result = [];
		for (var ticket_id in this.tickets) {
			if (this.tickets[ticket_id].has_metadata < 1) {
				result.push(ticket_id);
			}
		}
		//console.log("otrs_queue(" + this.name + ").get_ticket_ids_without_metadata(): Info: Returning " + result.length + " ticket ids.");
		return result;
	}
	
	this.get_missing_ticket_metadata = function(otrs_soap_client) {
		var new_context = new Object;
		new_context.self = otrs_soap_client;
		new_context.queue_name = this.name;
		
		var ticket_ids = this.get_ticket_ids_without_metadata();
		for (var index = 0; index < ticket_ids.length; index++) {
			setTimeout(function(otrs_soap_client, index, new_context) {
				otrs_soap_client.get_ticket_metadata(ticket_ids[index], new_context);
			}, (index * (otrs_soap_client.throttle_factor)), otrs_soap_client, index, new_context);
		}
	}
}

function otrs_soap_client () {
	this.throttle_factor = 500;
	this.OTRSRPCURL = '';
	this.OTRSSoapUsername = '';
	this.OTRSSoapPassword = '';
	this.OTRSUserId = 0;
	this.queues_available = {};
	this.queues_selected = [];
	this.otrs_queues = {};
	this.states_available = {};
	
	//TODO: this should be dynamic
	this.states_available = {
		1: "New",
		4: "Open",
		9: "Merged",
		11: "Pending - Approval",
		12: "Pending - Client",
		13: "Pending - Vendor",
		16: "Closed - Ready to Bill",
		17: "Pending - Parent",
		18: "Pending - Onsite Visit",
		19: "Pending - After Hours"
	}
	
	//TODO: this should be dynamic
	this.states_pending = ["11", "12", "13", "17", "18", "19"];
	
	this.soap_request = function (request_data, context, callback_success, callback_error) {
		// jquery.soap.js has been modified so that whatever is passed as
		//  "context" ends up as an argument on the "success" function.  This
		//  allow us to pass data to the callback function so it's possible to
		//  work out what request it relates to.
		context.callback_success = callback_success;
		context.callback_error = callback_error;
		
		$.soap({
			url: this.OTRSRPCURL,
			context: context,
			appendMethodToURL: false,
			namespaceURL: "urn:Core",
			method: 'Dispatch',
			SOAPAction: 'urn:Core#Dispatch',
			data: request_data,
			envAttributes: {
    			"soap:encodingStyle": "http://schemas.xmlsoap.org/soap/encoding/",
    			"xmlns:soapenc": "http://schemas.xmlsoap.org/soap/encoding/",
    			"xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
    			"xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"
    		},
    		beforeSend: function (SOAPEnvelope) {
				console.log("Request: " + SOAPEnvelope);
			},
			success: function (soapResponse, context) {
				console.log("Success (" + context.queue_name + "): " + soapResponse);
				console.log(context);
				xml_response = soapResponse.toXML();
				context.callback_success(xml_response, context);
			},
			error: function (soapResponse) {
				console.log("Error: " + soapResponse);
				context.callback_error(soapResponse, context);
			}
		});
	}
	
	this.get_queuetickets = function (queue_name) {
		var new_context = new Object;
		new_context.self = this;
		new_context.queue_name = queue_name;
		
		//Create a new otrs_queue object if one doesn't already exist
		if (this.otrs_queues[queue_name] === undefined) {
			console.log("get_queuetickets(" + queue_name + "): New otrs_queue object created for '" + queue_name + "'.");
			this.otrs_queues[queue_name] = new otrs_queue(queue_name);
		}
		else {
			console.log("get_queuetickets(" + queue_name + "): " + this.otrs_queues[queue_name]);
		}
		
		var request_data = [];
		if (queue_name.match(/_my_tickets_/i)) {
			request_data = [
				this.OTRSSoapUsername,
				this.OTRSSoapPassword,
				"TicketObject",
				"TicketSearch",
				"UserID",	this.OTRSUserId,
				"Limit",	"50",
				"OwnerIDs",	[ this.OTRSUserId ],
				"States",	[ "New", "Open", "Pending - After Hours", "Pending - Approval", "Pending - Client", "Pending - Onsite Visit", "Pending - Parent", "Pending - Vendor" ],
				"Result",	"ARRAY"
			];
		}
		else {
			request_data = [
				this.OTRSSoapUsername,
				this.OTRSSoapPassword,
				"TicketObject",
				"TicketSearch",
				"UserID",	this.OTRSUserId,
				"Limit",	"50",
				"Queues",	[ queue_name ],
				"States",	[ "New", "Open", "Pending - After Hours", "Pending - Approval", "Pending - Client", "Pending - Onsite Visit", "Pending - Parent", "Pending - Vendor" ],
				"Result",	"ARRAY"
			];
		}
		
		var callback_success = function(xml_response, context) {
			var new_ticket_ids = [];
			console.log("get_queuetickets(" + context.queue_name + "): Ticket Count: " + xml_response.getElementsByTagName("DispatchResponse")[0].childNodes.length);
			for (var index = 0; index < xml_response.getElementsByTagName("DispatchResponse")[0].childNodes.length; index++) {
				new_ticket_ids.push(xml_response.getElementsByTagName("DispatchResponse")[0].childNodes[index].textContent);
			}
			if (context.self.otrs_queues[context.queue_name] === undefined) {
				console.log("get_queuetickets(" + context.queue_name + "): Error: otrs_queues[" + context.queue_name + "] is undefined.");
			}
			else {
				//Update the otrs_queue object with the new list of ticket ids (it will handle removing the old).
				context.self.otrs_queues[context.queue_name].set_ticket_ids(new_ticket_ids);
				
				//Take a short break (i.e. limit cpu usage), then ask the otrs_queue object to fetch the metadata for
				// any otrs_ticket objects that don't have it.
				setTimeout(function(context) {
					context.self.otrs_queues[context.queue_name].get_missing_ticket_metadata(context.self);
				}, 500, context);
			}
		}
		
		this.soap_request(request_data, new_context, callback_success, function() {});
	}
	
	this.get_ownedtickets = function (owner_id) {
		return this.get_queuetickets('_my_tickets_');
	}
	
	this.get_ownedtickets_old = function (owner_id) {
		$.soap({
			url: "http://service.mach.com.au/otrs/rpc.pl",
			appendMethodToURL: false,
			context: this,
			soap12: true,
			namespaceURL: "/Core",
			method: 'Dispatch',
			SOAPAction: 'Dispatch',
			data: function(SOAPObject, context) {
        		return new SOAPObject('soap:Envelope')
            	.addNamespace('soap', 'http://schemas.xmlsoap.org/soap/envelope/')
            	.newChild('soap:Body')
            	.newChild('Dispatch').attr("xmlns", "urn:Core")
            	.newChild('c-gensym3').val(context.self.OTRSSoapUsername).attr("xsi:type", "xsd:string").end()
            	.newChild('c-gensym5').val(context.self.OTRSSoapPassword).attr("xsi:type", "xsd:string").end()
            	.newChild('c-gensym7').val("TicketObject").attr("xsi:type", "xsd:string").end()
            	.newChild('c-gensym9').val("TicketSearch").attr("xsi:type", "xsd:string").end()
            	.newChild('c-gensym11').val("UserID").attr("xsi:type", "xsd:string").end()
            	.newChild('c-gensym13').val(context.self.OTRSUserId).attr("xsi:type", "xsd:int").end()
            	.newChild('c-gensym15').val("Limit").attr("xsi:type", "xsd:string").end()
            	.newChild('c-gensym17').val("50").attr("xsi:type", "xsd:int").end()
            	.newChild('c-gensym19').val("Queues").attr("xsi:type", "xsd:string").end()
            	.newChild('soapenc:Array').attr("xsi:type", "soapenc:Array").attr("soapenc:arrayType", "xsd:string[1]")
            		.newChild('item').val(queue_name).attr("xsi:type", "xsd:string").end()
            		.end()
            	.newChild('c-gensym21').val("States").attr("xsi:type", "xsd:string").end()
            	.newChild('soapenc:Array').attr("xsi:type", "soapenc:Array").attr("soapenc:arrayType", "xsd:string[7]")
            		.newChild('item').val("New").attr("xsi:type", "xsd:string").end()
            		.newChild('item').val("Pending - After Hours").attr("xsi:type", "xsd:string").end()
            		.newChild('item').val("Pending - Approval").attr("xsi:type", "xsd:string").end()
            		.newChild('item').val("Pending - Client").attr("xsi:type", "xsd:string").end()
            		.newChild('item').val("Pending - Onsite Visit").attr("xsi:type", "xsd:string").end()
            		.newChild('item').val("Pending - Parent").attr("xsi:type", "xsd:string").end()
            		.newChild('item').val("Pending - Vendor").attr("xsi:type", "xsd:string").end()
            		.end()
            	//.newChild('c-gensym15').val("OwnerID").attr("xsi:type", "xsd:string").end()
            	//.newChild('c-gensym17').val("5").attr("xsi:type", "xsd:int").end()
            	.end()
            },
			beforeSend: function (SOAPEnvelope) {
				console.log("Request: " + SOAPEnvelope);
			},
			success: function (soapResponse, queue_name) {
				console.log("Success (" + queue_name + "): " + soapResponse);
			},
			error: function (soapResponse) {
				console.log("Error: " + soapResponse);
			}
		});
	}
	
	this.get_ticket_metadata = function (ticket_id, context) {
		console.log("get_ticket_metadata(" + ticket_id + ")");
		
		var new_context = new Object;
		new_context.self = context.self;
		new_context.queue_name = context.queue_name;
		new_context.ticket_id = ticket_id;
		
		var request_data = [
			this.OTRSSoapUsername,
			this.OTRSSoapPassword,
			"TicketObject",
			"TicketGet",
			"UserID",	this.OTRSUserId,
			"TicketID",	ticket_id,
		];
		
		var callback_success = function(xml_response, context) {
			console.log("get_ticket_metadata: success (" + context.queue_name + ":" + context.ticket_id + "): " + xml_response);
			var ticket = context.self.otrs_queues[context.queue_name].tickets[context.ticket_id];
			for (var index = 0; index < xml_response.getElementsByTagName("DispatchResponse")[0].childNodes.length; index++) {
				this_node = xml_response.getElementsByTagName("DispatchResponse")[0].childNodes[index];
				next_node = xml_response.getElementsByTagName("DispatchResponse")[0].childNodes[index + 1];
				if (this_node.textContent.match(/^age$/i)) {
					//console.log("get_ticket_metadata: success (" + context.queue_name + ":" + context.ticket_id + "): Info: Ticket Age: " + next_node.textContent);
					ticket.age = next_node.textContent;
				}
				else if (this_node.textContent.match(/^stateid$/i)) {
					ticket.state_id = next_node.textContent;
				}
				else if (this_node.textContent.match(/^state$/i)) {
					ticket.state = next_node.textContent;
				}
				else if (this_node.textContent.match(/^ownerid$/i)) {
					ticket.owner_id = next_node.textContent;
				}
				else if (this_node.textContent.match(/^owner$/i)) {
					ticket.owner = next_node.textContent;
				}
				else if (this_node.textContent.match(/^type$/i)) {
					ticket.type_name = next_node.textContent;
				}
				else if (this_node.textContent.match(/^typeid$/i)) {
					ticket.type_id = next_node.textContent;
				}
				else if (this_node.textContent.match(/^priority$/i)) {
					ticket.priority = next_node.textContent;
				}
				else if (this_node.textContent.match(/^queue$/i)) {
					ticket.queue = next_node.textContent;
				}
				else if (this_node.textContent.match(/^title$/i)) {
					ticket.title = next_node.textContent;
				}
				else if (this_node.textContent.match(/^ticketnumber$/i)) {
					ticket.ticket_number = next_node.textContent;
				}
			}
			ticket.has_metadata = 1;
			console.log(ticket);
		}
		
		this.soap_request(request_data, new_context, callback_success, function() {});
	}
	
	this.get_queues = function() {
		var new_context = new Object;
		new_context.self = this;
		
		var request_data = [
			this.OTRSSoapUsername,
			this.OTRSSoapPassword,
			"QueueObject",
			"GetAllQueues",
			"UserID",	this.OTRSUserId,
		];
		
		var callback_success = function(xml_response, context) {
			console.log(context);
			for (var index = 0; index < xml_response.getElementsByTagName("DispatchResponse")[0].childNodes.length; index++) {
				this_node = xml_response.getElementsByTagName("DispatchResponse")[0].childNodes[index];
				next_node = xml_response.getElementsByTagName("DispatchResponse")[0].childNodes[index + 1];
				if (jQuery.isNumeric(this_node.textContent)) {
					context.self.queues_available[parseInt(this_node.textContent)] = next_node.textContent;
				}
			}
		}
		
		this.soap_request(request_data, new_context, callback_success, function() {});
	}
	
	this.get_states = function() {
		var new_context = new Object;
		new_context.self = this;
		
		var request_data = [
			this.OTRSSoapUsername,
			this.OTRSSoapPassword,
			"StateObject",
			"StateList",
			"UserID",	this.OTRSUserId,
			"Valid", "1"
		];
		
		var callback_success = function(xml_response, context) {
			console.log(context);
			for (var index = 0; index < xml_response.getElementsByTagName("DispatchResponse")[0].childNodes.length; index++) {
				this_node = xml_response.getElementsByTagName("DispatchResponse")[0].childNodes[index];
				next_node = xml_response.getElementsByTagName("DispatchResponse")[0].childNodes[index + 1];
				if (jQuery.isNumeric(this_node.textContent)) {
					console.log("otrs.get_states(): Info: New State: " + this_node.textContent + " = " + next_node.textContent);
					context.self.states_available[parseInt(this_node.textContent)] = next_node.textContent;
				}
			}
		}
		
		this.soap_request(request_data, new_context, callback_success, function() {});
	}
}

var otrs = new otrs_soap_client();
var RefreshCache_timeout = 0;
var browser_action_anim_timeout = 0;
var browser_action_anim_frame = 0;
var enabled = 0;
var default_config = {
	'OTRSUserId': 5,
	'OTRSVersion': '3.0.x',
	'OTRSSoapUsername': "soap_user",
	'OTRSSoapPassword': "soap_pass",
	'OTRSRPCURL': "http://servicedesk.your.domain/otrs/rpc.pl",
	'OTRSIndexURL': "http://servicedesk.your.domain/otrs/index.pl",
	'EnableOnBrowserStartup': 0,
	'home_queue': "_my_tickets_",
}

function browser_action_anim_start() {
	browser_action_anim_frame = 0;
	browser_action_anim_continue();
}

function browser_action_anim_stop() {
	clearTimeout(browser_action_anim_timeout);
	chrome.browserAction.setIcon({path: "images/OTRSIcon_anim_frames/0.png"});
}

function browser_action_anim_continue() {
	browser_action_anim_frame++;
	var continue_anim = 0;
	if (browser_action_anim_frame > 9) {
		browser_action_anim_frame = 0;
		
		// Run these checks only on the anim restart (every 10th loop) to limit load.
		for (var queue_name in otrs.otrs_queues) {
			if (otrs.otrs_queues[queue_name].loaded() < 1) {
				continue_anim = 1;
			}
		}
	}
	
	if (continue_anim > 0) {
		chrome.browserAction.setIcon({path: "images/OTRSIcon_anim_frames/" + browser_action_anim_frame + ".png"}, function() {
			browser_action_anim_timeout = setTimeout(function() {
				browser_action_anim_continue();
			}, 150);
		});
	}
	else {
		browser_action_anim_stop();
	}
}

chrome.runtime.onInstalled.addListener(function() {
	var OTRSVersion = "3.0.x";
	
	otrs.queues_selected = ["Triage", "Delivery::Service Desk"];
	
	chrome.storage.sync.get(default_config, function(items) {
		if (items.OTRSUserId) {
			otrs.OTRSUserId = items.OTRSUserId;
		}
		
		if (items.OTRSSoapUsername) {
			otrs.OTRSSoapUsername = items.OTRSSoapUsername;
		}
			
		if (items.OTRSSoapPassword) {
			otrs.OTRSSoapPassword = items.OTRSSoapPassword;
		}
		
		if (items.OTRSRPCURL) {
			otrs.OTRSRPCURL = items.OTRSRPCURL;
		}
		
		if (items.EnableOnBrowserStartup) {
			enabled = items.EnableOnBrowserStartup;
		}
		OnSettingsLoaded();
	});
});

function OnSettingsLoaded() {
	if ((otrs.OTRSUserId > 0) && (otrs.OTRSSoapUsername.length > 0) && (otrs.OTRSSoapPassword.length > 0) && (otrs.OTRSRPCURL.length > 0)) {
		otrs.get_states();
		otrs.get_queues();
		RefreshCache();
	}
	else {
		setTimeout(function() {
			OnSettingsLoaded();
		}, 500);
	}
}

function RefreshCache() {
	if (enabled) {
		for (var index = 0; index < otrs.queues_selected.length; index++) {
			setTimeout(function(otrs, index) {
				console.log(otrs)
				browser_action_anim_start();
				otrs.get_queuetickets(otrs.queues_selected[index]);
			}, ((otrs.throttle_factor * 4) + (index * (otrs.throttle_factor * 4))), otrs, index);
		}
		setTimeout(function(otrs) {
			browser_action_anim_start();
			otrs.get_ownedtickets(otrs.OTRSUserId);
		}, (otrs.throttle_factor * 4), otrs);
		
		// Periodically refresh the metadata cache
		clearTimeout(RefreshCache_timeout);
		setTimeout(function() {
			RefreshCache();
		}, 60000);
	}
	else {
		// Periodically check to see if we've been enabled
		clearTimeout(RefreshCache_timeout);
		setTimeout(function() {
			RefreshCache();
		}, 1000);
	}
}