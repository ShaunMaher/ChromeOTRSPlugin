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

var queues_available = {};
var states_available = {};
var OTRSVersion = 300;
var otrs_client_required_settings = {};
var otrs_client_default_settings = {};
var otrs_client_setting_hints = {};

function ShortenQueueName(name) {
	if (name.length > 30) {
		new_name = name.substring(0,14) + " ... " + name.substring((name.length - 14));
		return new_name;
	}
	else {
		return name;
	}
}

function OnLoad() {
	queues_available = chrome.extension.getBackgroundPage().otrs.queues_available;
	states_available = chrome.extension.getBackgroundPage().otrs.states_available;
	
	// Add handlers to various buttons, etc.
	$("#Save").click(function(event) {
		Save();
	});
	
	$("#Cancel").click(function(event) {
		Cancel();
	});
	
	$("#back_button").click(function(event) {
		Cancel();
	});
	
	// What OTRS client versions are available
	var available_otrs_client_versions = chrome.extension.getBackgroundPage().available_otrs_client_versions
	console.log(available_otrs_client_versions);
	for (var version in available_otrs_client_versions) {
		$("#OTRSVersion").append(new Option(available_otrs_client_versions[version], version));
	}
	
	// Populate the list of queues in the home_queue select box and the area of checkboxes.
	$("#other_queues").empty();
	for (var queue_id in queues_available) {
		$("#home_queue").append(new Option(ShortenQueueName(queues_available[queue_id]), queues_available[queue_id]));
		
		var new_html = "";
		new_html += "<div>";
		new_html += "  <input type=checkbox id=\"select_queue_" + queue_id + "\"> " + ShortenQueueName(queues_available[queue_id])
		new_html += "</div>";
		console.log(new_html);
		$("#other_queues").append(new_html);
	}
	
	$("#select_states").empty();
	for (var state_id in states_available) {
		
		var new_html = "";
		new_html += "<div>";
		new_html += "  <input type=checkbox id=\"select_state_" + state_id + "\"> " + states_available[state_id]
		new_html += "</div>";
		$("#select_states").append(new_html);
	}
	
	// Populate all the form items with the saved values
	chrome.storage.sync.get({"OTRSVersion": OTRSVersion}, function(items) {
		// Do things
		if (chrome.extension.getBackgroundPage().otrs_client_required_settings[items.OTRSVersion]) {
			console.log("Options.js:OnLoad(): Using configured OTRS version " + items.OTRSVersion);
			otrs_client_required_settings = chrome.extension.getBackgroundPage().otrs_client_required_settings[items.OTRSVersion];
			otrs_client_default_settings = chrome.extension.getBackgroundPage().otrs_client_default_settings[items.OTRSVersion];
			otrs_client_setting_hints = chrome.extension.getBackgroundPage().otrs_client_setting_hints[items.OTRSVersion];
		}
		else {
			console.log("Options.js:OnLoad(): otrs_client_required_settings array doesn't contain an index for OTRS version " + items.OTRSVersion);
			otrs_client_required_settings = chrome.extension.getBackgroundPage().otrs_client_required_settings["300"];
			otrs_client_default_settings = chrome.extension.getBackgroundPage().otrs_client_default_settings["300"];
			otrs_client_setting_hints = chrome.extension.getBackgroundPage().otrs_client_setting_hints["300"];
		}
		
		for (var item_name in otrs_client_required_settings) {
			console.log("Options.js:OnLoad(): New configuration option: " + item_name);
			
			// Compose some new HTML for this client's settings
			var new_html = "";
			new_html += "<tr>";
			new_html += "<td>" + otrs_client_required_settings[item_name][1] + "</td>";
			if (otrs_client_required_settings[item_name][0] == "s") {
				new_html += "<td><input type=text id=\"" + item_name + "\" name=\"" + item_name + "\" value=\"\"></td>";
			}
			new_html += "</tr>";
			
			// Add a row for the "hint" text
			if (otrs_client_setting_hints[item_name]) {
				new_html += "<tr>";
	  			new_html += "<td colspan=2 align=right class=\"hint\">";
	  			new_html += otrs_client_setting_hints[item_name];
	  			new_html += "</td>";
	  			new_html += "</tr>";
	  		}
			
			$("#OTRSServerSettings").after(new_html);
		}
		
		chrome.storage.sync.get(chrome.extension.getBackgroundPage().default_config, function(items) {
			console.log(items);
			
			// Set each item that the OTRS client is expecting to the value loaded
			for (var item_name in otrs_client_default_settings) {
				if (items[item_name]) {
					$("#" + item_name).val(items[item_name]);
				}
			}
			
			if (items.EnableOnBrowserStartup) {
				if (items.EnableOnBrowserStartup > 0) {
					$("#EnableOnBrowserStartup").attr( "checked", true);
				}
			}
			
			if (items.OTRSHomeQueue) {
				//TODO
			}
			
			if (items.OTRSVersion) {
				//TODO
			}
			
			if (items.OTRSQueuesSelected) {
				console.log(items.OTRSQueuesSelected);
				for (queue_id in queues_available) {
					if (items.OTRSQueuesSelected.indexOf(queues_available[queue_id]) != -1) {
						$("#select_queue_" + queue_id).attr( "checked", true);
					}
				}
			}
		});
	});
}

function Save() {
	
	// Convert the state of the EnableOnBrowserStartup checkbox into an integer
	var EnableOnBrowserStartup = 0;
	if ($("#EnableOnBrowserStartup").prop( "checked" )) {
		EnableOnBrowserStartup = 1;
	}
	
	// Add queues that are selected to an array
	var queues_selected = [];
	for (queue_id in queues_available) {
		if ($("#select_queue_" + queue_id).prop("checked")) {
			console.log("Queue selected: " + queues_available[queue_id]);
			queues_selected.push(queues_available[queue_id]);
		}
	}
	
	// Save settings to Chrome's store
	chrome.storage.sync.set({
		OTRSVersion: $("#OTRSVersion").val(),
		OTRSUserId: $("#OTRSUserId").val(),
		OTRSSoapUsername: $("#OTRSSoapUsername").val(),
		OTRSSoapPassword: $("#OTRSSoapPassword").val(),
		OTRSRPCURL: $("#OTRSRPCURL").val(),
		OTRSIndexURL: $("#OTRSIndexURL").val(),
		OTRSQueuesSelected: queues_selected,
		home_queue: $("#home_queue").val(),
		EnableOnBrowserStartup: EnableOnBrowserStartup
	}, function() {
		// Trigger a RefreshCache() so that any new queues selected have objects created and start caching
		chrome.extension.getBackgroundPage().RefreshCache();
		
		// Go to the QueueView screen
		location.href = 'QueueView.html';
	});
}

function Cancel() {
	location.href = 'QueueView.html';
}

document.addEventListener('DOMContentLoaded', function () {
	OnLoad();
});