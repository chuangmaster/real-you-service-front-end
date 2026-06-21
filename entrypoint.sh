#!/bin/sh
RAW_RESOLVER=$(awk '/nameserver/{print $2; exit}' /etc/resolv.conf)
RAW_RESOLVER=${RAW_RESOLVER:-8.8.8.8}

# Wrap IPv6 addresses in brackets and append port 53 for nginx resolver syntax
if echo "$RAW_RESOLVER" | grep -q ':'; then
    export DNS_RESOLVER="[${RAW_RESOLVER}]:53"
else
    export DNS_RESOLVER="${RAW_RESOLVER}:53"
fi

exec /docker-entrypoint.sh "$@"
