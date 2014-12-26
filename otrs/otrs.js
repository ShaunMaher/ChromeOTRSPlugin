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

var available_otrs_client_versions = {};
var otrs_client_required_settings = {};
var otrs_client_default_settings = {};
var otrs_client_setting_hints = {};

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
	this.customer_userid = '';
	this.priority = '';
	this.queue = '';
	this.metadata_refresh_time = 0;
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
		// Find the tickets that are in our local list but not in the new list and delete them
		for (var index = 0; index < this.ticket_ids.length; index++) {
			if (new_ticket_ids.indexOf(this.ticket_ids[index]) < 0) {
				console.log("otrs_queue(" + this.name + ").set_ticket_ids(): Info: Ticket deleted from cache: " + this.ticket_ids[index]);
				delete this.tickets[this.ticket_ids[index]];
				this.ticket_ids.splice(index, 1);
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
	
	// This isn't significantly different from the above.  Main difference is that stale metadata won't
	//  result in the loading screen while missing metadata will.
	this.refresh_ticket_metadata = function(otrs_soap_client) {
		var new_context = new Object;
		new_context.self = otrs_soap_client;
		new_context.queue_name = this.name;
		
		for (var ticket_id in this.tickets) {
			if ((((new Date().getTime()) - 300000) > this.tickets[ticket_id].metadata_refresh_time) && (this.tickets[ticket_id].has_metadata > 0)) {
				console.log("otrs_queue(" + this.name + ").refresh_ticket_metadata(): Info: Time up update the metadata for ticket: " + ticket_id + ":" + this.tickets[ticket_id].metadata_refresh_time + ":" + (new Date().getTime()))
				setTimeout(function(otrs_soap_client, ticket_id, new_context) {
					otrs_soap_client.get_ticket_metadata(ticket_id, new_context);
				}, (4 * (otrs_soap_client.throttle_factor)), otrs_soap_client, ticket_id, new_context);
			}
		}
	}	
}