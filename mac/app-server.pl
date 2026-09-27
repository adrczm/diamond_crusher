#!/usr/bin/perl
# Tiny local web server for Diamond Crusher on a Mac. It only answers this computer (127.0.0.1), only serves the files
# in the app folder, and never contacts anything else. Uses Perl, which comes with macOS, so nothing needs installing.
use strict;
use warnings;
use IO::Socket::INET;
use File::Spec;
use Cwd qw(abs_path);

my ($port, $root) = @ARGV;
$port ||= 47820;
$root = abs_path($root || 'app');
die "App folder not found: $root\n" unless -f "$root/index.html";

my %types = (
  html => 'text/html; charset=utf-8', js => 'text/javascript; charset=utf-8', css => 'text/css',
  json => 'application/json', wasm => 'application/wasm', png => 'image/png', jpg => 'image/jpeg',
  ico => 'image/x-icon', svg => 'image/svg+xml', ttf => 'font/ttf', otf => 'font/otf', woff => 'font/woff',
  woff2 => 'font/woff2', wav => 'audio/wav', mp3 => 'audio/mpeg', txt => 'text/plain; charset=utf-8',
);

my $server = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Proto => 'tcp', Listen => 16, ReuseAddr => 1)
  or die "Could not start on port $port (is Diamond Crusher already running?): $!\n";
print "Diamond Crusher is running at http://localhost:$port/\n";

# A browser that stops a download midway must not stop the server, and each request runs in its own short-lived
# process so an idle connection (browsers open spare ones) can't hold up the others.
$SIG{PIPE} = 'IGNORE';
$SIG{CHLD} = 'IGNORE';

sub send_file {
  my ($c, $path, $head_only) = @_;
  my ($ext) = $path =~ /\.([A-Za-z0-9]+)$/;
  my $type = $types{lc($ext // '')} // 'application/octet-stream';
  open(my $fh, '<:raw', $path) or return 0;
  my $size = -s $path;
  print $c "HTTP/1.1 200 OK\r\nContent-Type: $type\r\nContent-Length: $size\r\nCache-Control: no-cache\r\n"
    . "X-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n";
  unless ($head_only) {
    my $buf;
    print $c $buf while read($fh, $buf, 65536);
  }
  close $fh;
  return 1;
}

while (1) {
  my $c = $server->accept or next;
  my $pid = fork;
  if (!defined $pid || $pid) {
    close $c;
    next;
  }
  close $server;
  alarm 30;
  binmode $c;
  my $line = <$c> // '';
  while (my $h = <$c>) { last if $h =~ /^\r?\n$/ }
  my ($method, $target) = $line =~ /^(GET|HEAD) (\S+) HTTP/;
  if (!$method) {
    print $c "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    close $c;
    exit 0;
  }
  (my $p = $target) =~ s/[?#].*//;
  $p =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
  $p = '/index.html' if $p eq '/';
  my @parts = grep { length && $_ ne '.' } split m{/}, $p;
  my $file = (grep { $_ eq '..' } @parts) ? undef : File::Spec->catfile($root, @parts);
  # Anything that isn't a file is a page inside the app: hand back the app itself.
  $file = "$root/index.html" unless defined $file && -f $file;
  send_file($c, $file, $method eq 'HEAD');
  close $c;
  exit 0;
}
