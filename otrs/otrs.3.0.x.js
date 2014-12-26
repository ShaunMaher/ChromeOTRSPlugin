/*
   Copyright 2014 Shaun Maher <shaun@ghanima.net>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

available_otrs_client_versions["300"] = "3.0.x";
otrs_client_required_settings["300"] = {
	OTRSRPCURL: "OTRS RPC URL",
	OTRSIndexURL: "OTRS Index URL",
	OTRSSoapUsername: "",
	OTRSSoapPassword: "",
	OTRSUserId: ""
};

function otrs_client_300 () {
	this.throttle_factor = 500;
	this.OTRSRPCURL = '';
	this.OTRSIndexURL = '';
	this.OTRSSoapUsername = '';
	this.OTRSSoapPassword = '';
	this.OTRSUserId = 0;
	this.queues_available = {};
	this.queues_selected = [];
	this.otrs_queues = {};
	this.states_available = {};
	this.soap_debug = 0;
	
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
	
	this.get_create_ticket_url = function() {
		return this.OTRSIndexURL + '?Action=AgentTicketEmail';
	}
	
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
				//console.log("Request: " + SOAPEnvelope);
			},
			success: function (soapResponse, context) {
				//console.log("Success (" + context.queue_name + "): " + soapResponse);
				//console.log(context);
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
			console.log("otrs_soap_client_300.get_queuetickets(" + queue_name + "): New otrs_queue object created for '" + queue_name + "'.");
			this.otrs_queues[queue_name] = new otrs_queue(queue_name);
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
			console.log("otrs_soap_client_300.get_queuetickets(" + context.queue_name + "): Ticket Count: " + xml_response.getElementsByTagName("DispatchResponse")[0].childNodes.length);
			for (var index = 0; index < xml_response.getElementsByTagName("DispatchResponse")[0].childNodes.length; index++) {
				new_ticket_ids.push(xml_response.getElementsByTagName("DispatchResponse")[0].childNodes[index].textContent);
			}
			if (context.self.otrs_queues[context.queue_name] === undefined) {
				console.log("otrs_soap_client_300.get_queuetickets(" + context.queue_name + "): Error: otrs_queues[" + context.queue_name + "] is undefined.");
			}
			else {
				//Update the otrs_queue object with the new list of ticket ids (it will handle removing the old).
				context.self.otrs_queues[context.queue_name].set_ticket_ids(new_ticket_ids);
				
				//Take a short break (i.e. limit cpu usage), then ask the otrs_queue object to fetch the metadata for
				// any otrs_ticket objects that don't have it and refresh metadata that's stale.
				setTimeout(function(context) {
					context.self.otrs_queues[context.queue_name].get_missing_ticket_metadata(context.self);
					context.self.otrs_queues[context.queue_name].refresh_ticket_metadata(context.self);
				}, this.throttle_factor, context);
			}
		}
		
		this.soap_request(request_data, new_context, callback_success, function() {});
	}
	
	this.get_ownedtickets = function (owner_id) {
		return this.get_queuetickets('_my_tickets_');
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
			//console.log("get_ticket_metadata: success (" + context.queue_name + ":" + context.ticket_id + "): " + xml_response);
			console.log(xml_response);
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
				else if (this_node.textContent.match(/^customeruserid$/i)) {
					ticket.customer_userid = next_node.textContent;
				}
			}
			ticket.has_metadata = 1;
			ticket.metadata_refresh_time = new Date().getTime();
			//console.log(ticket);
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
			//console.log(context);
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