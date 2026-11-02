#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$DIR/backend/data/db"
GLIBC_TUNABLES=glibc.pthread.rseq=1 mongod --dbpath "$DIR/backend/data/db" --bind_ip 127.0.0.1 --port 27017 --logpath "$DIR/backend/data/mongod.log" --fork
