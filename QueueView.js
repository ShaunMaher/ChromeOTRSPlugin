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

var show_queue_timeout = '';
var home_queue_name = '';
var OTRSIndexURL = '';
var selected_queues = '';

// We need the make the names more friendly some times
function set_queue_button_name(queue_name, queue_button) {
	// Save the raw queue name into the object
	$(queue_button).attr("queue_name", queue_name);
	
	queue_name = nice_queue_name(queue_name);
	
	// Apply the name
	$(queue_button).text(queue_name);
}

function nice_queue_name(queue_name) {
	// Apply name alertations to the queue name to make it more readable
	if (queue_name.match(/_my_tickets_/)) {
		queue_name = "My Tickets";
	}
	else if (queue_name.match(/::/)) {
		queue_name = queue_name.split("::");
		queue_name = queue_name[(queue_name.length - 1)];
	}
	return queue_name;
}

function unselect_all_queue_buttons() {
	var index = 1;
	while ($("#queue_name_" + index).length > 0) {
		if ($("#queue_name_" + index).text().length > 1) {
			$("#queue_name_" + index).removeClass().addClass("queue_button");
		}
		index++;
	}
}

function OnLoad() {
	
	// Add an onclick handler to the options button
	$("#options_button").click(function(event) {
		location.href = "Options.html";
	});
	
	// Add an onclick handler to the options button
	$("#search_button").click(function(event) {
		location.href = "Search.html";
	});
	
	// Add an onclick handler to the options button
	$("#create_button").click(function(event) {
		setTimeout(function(event) {
			//console.log(chrome.extension.getBackgroundPage().otrs.get_create_ticket_url());
			chrome.tabs.create({ url: chrome.extension.getBackgroundPage().otrs.get_create_ticket_url() });
		}, 100, event);
	});
	
	// If the extension hasn't been started already (e.g. incognito mode), start it now.
	chrome.extension.getBackgroundPage().StartExtension();
	
	// If the extension is not enabled on startup, clicking the button to load this popup enables it
	chrome.extension.getBackgroundPage().enabled = 1;
	
	chrome.storage.sync.get(chrome.extension.getBackgroundPage().default_config, function(items) {
		// Save the URL to the OTRS index.pl, we'll need it later.
		if (items.OTRSIndexURL) {
			OTRSIndexURL = items.OTRSIndexURL;
		}
		
		// Remember which queues the user has selected
		if (items.OTRSQueuesSelected) {
			selected_queues = items.OTRSQueuesSelected;
		}
		
		// Populate the ticket list with tickets from the user's selected "Home Queue"
		if (items.home_queue) {
			home_queue_name = items.home_queue;
			console.log("chrome.storage.sync.get(home_queue): " + home_queue_name);
			show_queue(home_queue_name);
		}
		else {
			console.log("chrome.storage.sync.get(home_queue): returned no data.");
		}
	});
	
}

function list_queues(current_queue_name) {
	$("#queue_list").empty();
	for (var index = 0; index < selected_queues.length; index++) {
		var this_queue = selected_queues[index];
		//if (selected_queues[index] != current_queue_name) {
			// The circle that indicates the state has the first letter of the queue name
			initial = nice_queue_name(this_queue).substring(0,1).toUpperCase();
			
			var new_html = "";
			new_html += "<div class=\"queue_link\" queue_name=\"" + this_queue + "\" id=\"queue_link_" + index + "\"";
			if (this_queue == current_queue_name) {
				new_html += " style=\"display: none;\"";
			}
			new_html += ">";
			if (this_queue == '_my_tickets_') {
				new_html += "  <span class=\"queue_link_my_tickets\">&nbsp;</span>";
			}
			else {
				new_html += "  <span class=\"queue_link_other\">" + initial + "</span>";
			}
			new_html += "  <span class=\"queue_link_title\">" + nice_queue_name(this_queue) + "</span>";
			new_html += "</div>";
			$("#queue_list").append(new_html);
		//}
	}
	
	// Attach OnClick events to the new queue buttons.
	var index = 0;
	while ($("#queue_link_" + index).length > 0) {
		$("#queue_link_" + index).click(function(event) {
			console.log(event.currentTarget.id + " " + event.currentTarget.attributes["queue_name"].value);
			//unselect_all_queue_buttons();
			//$("#" + event.currentTarget.id).removeClass().addClass("queue_button_selected");
			show_queue(event.currentTarget.attributes["queue_name"].value);
		});
		index++
	}
}

function list_tickets(tickets) {
	$("#list_inner").empty();
	$("#loading_anim").removeClass().addClass("loading_invisible");
	
	// Create new html objects to represent the tickets
	for (var ticket_id in tickets) {
		ticket = tickets[ticket_id];
		
		// The circle that indicates the state has the first letter of the client's email domain
		initial = ticket.customer_userid.split("@")[1].substring(0,1).toUpperCase();
		
		var new_html = "";
		new_html += "<div class=\"ticket_link\" href=\"" + OTRSIndexURL + "?Action=AgentTicketZoom;TicketID=" + ticket_id + "\">";
		if (chrome.extension.getBackgroundPage().otrs.states_pending.indexOf(ticket.state_id) > -1) {
			new_html += "  <span class=\"ticket_link_state_pending\" title=\"" + ticket.state + "\">" + initial + "</span>";
		}
		else {
			new_html += "  <span class=\"ticket_link_state_open\" title=\"" + ticket.state + "\">" + initial + "</span>";
		}
		new_html += "  <span class=\"ticket_link_number\" title=\"" + ticket.queue + "\">" + ticket.ticket_number + ": " + ticket.customer_userid + "</span><br/>";
		new_html += "  <span class=\"ticket_link_title\" title=\"" + ticket.title + '\n' + "\">" + ticket.title + "</span>";
		new_html += "</div>";
		//console.log(new_html);
		$("#list_inner").append(new_html);
	}
	
	// All of the ticket_link objects need an onclick handler so they actually do stuff
	$(".ticket_link").click(function(event) {
		console.log(event);
		if (event.currentTarget.attributes['href']) {
			// When a ticket_link span is clicked, optn the ticket in a new tab.  We use a setTimeout
			// here so this event's processing can complete and the new tab is created asynchronously
			setTimeout(function(event) {
				chrome.tabs.create({ url: event.currentTarget.attributes['href'].value });
			}, 100, event);
		}
	});
}

function show_queue(queue_name) {
	// Check to see if the background page has an "otrs" object.
	if (chrome.extension.getBackgroundPage().otrs) {
		var queue = chrome.extension.getBackgroundPage().otrs.otrs_queues[queue_name];
		console.log(queue);
		
		set_queue_button_name(queue_name, "#window_title");
		
		// If the queue metadata hasn't been loaded yet, don't list the tickets, call ourselves after a short
		//  delay to check again.
		if (queue.loaded() > 0) {
			list_queues(queue_name);
			list_tickets(queue.tickets);
		}
		else {
			console.log("show_queue(" + queue_name + "): Info: Queue metadata not yet loaded.  Will wait and try again.");
			$("#loading_anim").removeClass().addClass("loading_visible");
			$("#list_inner").empty();
			clearTimeout(show_queue_timeout);
			show_queue_timeout = setTimeout(function(queue_name) {
				show_queue(queue_name);
			}, 500, queue_name);
		}
	}
	else {
		// The "otrs" object is missing.  This is pretty much fatal but we loose nothing by retrying.
		console.log("chrome.extension.getBackgroundPage().otrs does not exist!  Will retry.");
		$("#loading_anim").removeClass().addClass("loading_visible");
		$("#list_inner").empty();
		clearTimeout(show_queue_timeout);
		show_queue_timeout = setTimeout(function(queue_name) {
			show_queue(queue_name);
		}, 500, queue_name);
	}
}

document.addEventListener('DOMContentLoaded', function () {
	OnLoad();
});