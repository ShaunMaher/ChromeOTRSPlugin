#!/usr/bin/perl -w
use SOAP::Lite ( 'autodispatch', proxy => 'http://service.mach.com.au/otrs/rpc.pl', trace => 'all');
my $User = 'soap_user';
my $Pw   = 's04p_pa55w0rd';

#my $RPC = Core->new();
#my %Ticket = $RPC->Dispatch($User,$Pw,'TicketObject','TicketSearch', UserID=>5, Limit=>50, Queues=>("Triage","Sales::Ask"));
#print "$Ticket{TicketNumber}\n";



my $soap = SOAP::Lite->new( proxy => 'http://service.mach.com.au/otrs/rpc.pl');

 #$soap->on_action( sub { "urn:Dispatch#TicketObject" });
 $soap->readable(1);
 $soap->default_ns('urn:Core');

 my $som = $soap->call('Dispatch', $User, $Pw, "TicketObject", "TicketSearch", 'UserID', 5 , 'Limit', 50, 'Queues', SOAP::Data->value(SOAP::Data->value([SOAP::Data->value("Sales::Ask")])));

die $som->fault->{ faultstring } if ($som->fault);
print $som->result, "\n";