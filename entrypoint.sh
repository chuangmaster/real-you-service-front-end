#!/bin/sh
export DNS_RESOLVER=$(awk '/nameserver/{print $2; exit}' /etc/resolv.conf)
export DNS_RESOLVER=${DNS_RESOLVER:-8.8.8.8}
exec /docker-entrypoint.sh "$@"
