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

var otrs = new otrs_soap_client_300();
var RefreshCache_timeout = 0;
var browser_action_anim_timeout = 0;
var browser_action_anim_frame = 0;
var enabled = 0;
var started = 0;
var default_config = {
	'OTRSUserId': 5,
	'OTRSVersion': '3.0.x',
	'OTRSSoapUsername': "soap_user",
	'OTRSSoapPassword': "soap_pass",
	'OTRSRPCURL': "http://servicedesk.your.domain/otrs/rpc.pl",
	'OTRSIndexURL': "http://servicedesk.your.domain/otrs/index.pl",
	'EnableOnBrowserStartup': 0,
	'home_queue': "_my_tickets_",
	'OTRSQueuesSelected': ["_my_tickets_"]
}

function browser_action_anim_start() {
	browser_action_anim_frame = 0;
	browser_action_anim_continue();
}

function browser_action_anim_stop() {
	clearTimeout(browser_action_anim_timeout);
	chrome.browserAction.setIcon({path: "images/OTRSIcon_anim_med_frames/0.png"});
}

function browser_action_anim_continue() {
	browser_action_anim_frame++;
	var continue_anim = 0;
	if (browser_action_anim_frame > 11) {
		browser_action_anim_frame = 0;
		
		// Run these checks only on the anim restart (every 10th loop) to limit load.
		for (var queue_name in otrs.otrs_queues) {
			if (otrs.otrs_queues[queue_name].loaded() < 1) {
				continue_anim = 1;
			}
		}
	}
	else {
		continue_anim = 1;
	}
	
	if (continue_anim > 0) {
		chrome.browserAction.setIcon({path: "images/OTRSIcon_anim_med_frames/" + browser_action_anim_frame + ".png"}, function() {
			clearTimeout(browser_action_anim_timeout);
			browser_action_anim_timeout = setTimeout(function() {
				browser_action_anim_continue();
			}, 80);
		});
	}
	else {
		browser_action_anim_stop();
	}
}

chrome.runtime.onInstalled.addListener(function() {
	StartExtension();
});

chrome.runtime.onStartup.addListener(function() {
	StartExtension();
});

function StartExtension() {
	if (started < 1) {
		console.log("background.js:StartExtension(): Extension startup triggered.");
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
			
			if (items.OTRSIndexURL) {
				otrs.OTRSIndexURL = items.OTRSIndexURL;
			}
			
			if (items.EnableOnBrowserStartup) {
				enabled = items.EnableOnBrowserStartup;
			}
			
			if (items.OTRSQueuesSelected) {
				console.log("queues selected: ");
				console.log(items.OTRSQueuesSelected);
				otrs.queues_selected = items.OTRSQueuesSelected;
			}
			
			if (items.OTRSHomeQueue) {
				otrs.queues_selected.push(items.OTRSHomeQueue);
			}
			
			OnSettingsLoaded();
		});
		started = 1;
	}
	else {
		console.log("background.js:StartExtension(): Extension not started, already running.");
	}
}

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
				//console.log(otrs)
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