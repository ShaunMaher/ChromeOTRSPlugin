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
	
	$("#Save").click(function(event) {
		Save();
	});
	
	$("#Cancel").click(function(event) {
		Cancel();
	});
	
	$("#back_button").click(function(event) {
		Cancel();
	});
	
	// Populate the list of queues in the home_queue select box and the area of checkboxes.
	$("#other_queues").empty();
	for (queue_id in queues_available) {
		$("#home_queue").append(new Option(ShortenQueueName(queues_available[queue_id], queue_id)));
		
		var new_html = "";
		new_html += "<div>";
		new_html += "  <input type=checkbox id=\"select_queue_" + queue_id + "\"> " + ShortenQueueName(queues_available[queue_id])
		new_html += "</div>";
		//console.log(new_html);
		$("#other_queues").append(new_html);
	}
	
	$("#select_states").empty();
	for (state_id in states_available) {
		
		var new_html = "";
		new_html += "<div>";
		new_html += "  <input type=checkbox id=\"select_queue_" + state_id + "\"> " + states_available[state_id]
		new_html += "</div>";
		//console.log(new_html);
		$("#select_states").append(new_html);
	}
	
	// Populate all the form items with the saved values
	chrome.storage.sync.get(chrome.extension.getBackgroundPage().default_config, function(items) {
		console.log(items);
		if (items.OTRSUserId) {
			$("#OTRSUserId").val(items.OTRSUserId);
		}
		
		if (items.OTRSSoapUsername) {
			$("#OTRSSoapUsername").val(items.OTRSSoapUsername);
		}
			
		if (items.OTRSSoapPassword) {
			$("#OTRSSoapPassword").val(items.OTRSSoapPassword);
		}
		
		if (items.OTRSRPCURL) {
			$("#OTRSRPCURL").val(items.OTRSRPCURL);
		}
		
		if (items.OTRSIndexURL) {
			$("#OTRSIndexURL").val(items.OTRSIndexURL);
		}
		if (items.EnableOnBrowserStartup) {
			if (items.EnableOnBrowserStartup > 0) {
				$("#EnableOnBrowserStartup").attr( "checked", true);
			}
		}
	});
}

function Save() {
	
	var EnableOnBrowserStartup = 0;
	if ($("#EnableOnBrowserStartup").prop( "checked" )) {
		EnableOnBrowserStartup = 1;
	}
	
	chrome.storage.sync.set({
		OTRSUserId: $("#OTRSUserId").val(),
		OTRSSoapUsername: $("#OTRSSoapUsername").val(),
		OTRSSoapPassword: $("#OTRSSoapPassword").val(),
		OTRSRPCURL: $("#OTRSRPCURL").val(),
		OTRSIndexURL: $("#OTRSIndexURL").val(),
		EnableOnBrowserStartup: EnableOnBrowserStartup
	}, function() {
		location.href = 'QueueView.html';
	});
}

function Cancel() {
	location.href = 'QueueView.html';
}

document.addEventListener('DOMContentLoaded', function () {
	OnLoad();
});