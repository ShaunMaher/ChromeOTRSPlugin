ChromeOTRSPlugin
================
This is a Google Chrome extension that provides quick access to tickets hosted
by the OTRS ticketing system.  It provides a familiar interface (clone of the
Android Gmail interface) that is quickly accessible from the Chrome button bar.

Features include:
  * Ticket metadata is fetched from the server periodically rather than on
    demand for immediate responsiveness
  * Clean, spacious interface that for each ticket presents:
    * Ticket number
    * Ticket user (i.e. the contact that submitted the ticket)
    * Open/Pending state
    * Ticket subject
  * Only show specific OTRS queues
  * Special queue "My Tickets" shows only tickets assigned to your user.
  * Only show tickets in specific states (not yet completely implemented)
  * Quick link to the OTRS ticket creation page

Currently only OTRS 3.0.x is supported with support for OTRS 4.0.x planned for
the near future.