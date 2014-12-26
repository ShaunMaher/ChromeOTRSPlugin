// Pull in jQuery and some additional requirements that make jQuery.soap work
var fs = require('fs');

global.DOMParser = require('xmldom').DOMParser;
var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
var $ = require('jquery')(require("jsdom").jsdom().parentWindow);
var jQuery = $;

//Enable cross-domain requests
$.support.cors = true;

// Use Node's built in XMLHttpRequest
$.ajaxSettings.xhr = function() {
    return new XMLHttpRequest();
};

//var extend = require('node.extend');

// Pull in jQuery.soap
eval(fs.readFileSync('jquery.soap/jquery.soap.js')+'');

// Pull in out OTRS extensions
eval(fs.readFileSync('otrs/otrs.js')+'');
eval(fs.readFileSync('otrs/otrs.3.0.x.js')+'');

// Pull in the ability to call external applications
var exec = require('child_process').exec;

var otrs = new otrs_soap_client_300();
var FindOldestTicket_timeout = 0;
var RefreshCache_timeout = 0;
var RefreshCache_first_run = 1;

// General Settings
var max_ticket_age = 900;		// 15 minutes
var min_ticket_age = 300;		// 5 minutes
var monitor_queue_name = 'Triage';	// The name of the queue for which the SLA applies

// GPIO (pigs) Settings
var green_gpio = 24;
var red_gpio = 25;

// OTRS Settings
otrs.throttle_factor = 1500;		// The Pi isn't the most powerful device.  This puts a limit on the speed soap requests are queued.
otrs.OTRSUserId = 5;
otrs.OTRSSoapUsername = 'soap_user';
otrs.OTRSSoapPassword = 's04p_pa55w0rd';
otrs.OTRSRPCURL = 'http://service.mach.com.au/otrs/rpc.pl';
otrs.OTRSIndexURL = 'http://service.mach.com.au/otrs/index.pl';

function SetOldestTicket(age) {
	// The scale we use for the resulting color is how far along the path
	//  from min_ticket_age to max_ticket_age the ticket is.  In other words, the
	//  first min_ticket_age is 100% green.  After this time we fade towards 100%
	//  red at the max_ticket_age point.

	// We subtract min_ticket_age from age.
	var value = (age - min_ticket_age);

	// Convert the age in seconds to a fraction of the distance to 255
	value = parseInt((value / (max_ticket_age - min_ticket_age)) * 255);

	// We cannot pass numbers greater than 255 or less than 0 to pigs
	if (value > 255) {
		value = 255;
	}
	if (value < 0) {
		value = 0;
	}

	console.log("SetOldestTicket(" + age + "): Colour value: " + value);

	exec('pigs PWM ' + red_gpio + ' ' + value + ' PWM ' + green_gpio + ' ' + (255 - value), function callback(error, stdout, stderr){
		// TODO: process the result
	});
}

function RefreshCache() {
	otrs.get_queuetickets('Triage');
	clearTimeout(RefreshCache_timeout);

	// If this is the first run of RefreshCache, we allow 120 seconds for the initial metadata download
	if (RefreshCache_first_run > 0) {
		RefreshCache_first_run = 0;
		setTimeout(function() {
			RefreshCache();
		}, 120000);
	}
	else {
		setTimeout(function() {
			RefreshCache();
		}, 20000);
	}
}

function FindOldestTicket() {
	var queue = otrs.otrs_queues['Triage'];
	if (queue.loaded() > 0) {
		console.log("FindOldestTicket(): Ready to find oldest ticket");
		var max_ticket_age = 0;
		for (var ticket_id in queue.tickets) {
			var ticket = queue.tickets[ticket_id];
			//console.log("FindOldestTicket(): Ticket ID: " + ticket_id + ", Age: " + ticket.age + ", Metadata Time: " + ticket.metadata_refresh_time);

			// ticket.age does not take into account the time since the metadata was
			//  refreshed.  The real age is (now - (ticket.metadata_refresh_time - ticket.age))
			//  For extra confusion, now and ticket.metadata_refresh_time are in milliseconds,
			//  ticket.age is in seconds.
			var real_age = parseInt(((new Date().getTime()) / 1000) - ((ticket.metadata_refresh_time / 1000) - parseInt(ticket.age)));

			if (real_age > max_ticket_age) {
				max_ticket_age = real_age;
			}
		}
		console.log("FindOldestTicket(): Oldest ticket is " + max_ticket_age + " seconds old.");
		SetOldestTicket(max_ticket_age);
	}
	clearTimeout(FindOldestTicket_timeout);
	setTimeout(function() {
                FindOldestTicket();
        }, 10000);
}

// Start the RefreshCache loop
setTimeout(function() {
	RefreshCache();
}, 1000);

// Start the FindOldestTicket loop (after RefreshCache has a 10 seconf head start)
setTimeout(function() {
        FindOldestTicket();
}, 10000);

//SetOldestTicket(800);