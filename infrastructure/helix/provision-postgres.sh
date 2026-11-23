#!/usr/bin/env bash
set -euo pipefail

# Run on Helix as the deploy user, once, before the first Kolibri deploy:
#   infrastructure/helix/provision-postgres.sh ghcr.io/gaulatti/kolibri:<commit-sha>
#
# Creates the `kolibri` role and database in Helix's existing PostgreSQL, through the local
# socket (the Docker group reaches it; the helper process takes the postgres UID for peer
# authentication), the way Alexandria's was provisioned. The generated password is kept in a
# 0600 file and is never printed. It is safe to rerun after both the role and the database exist.
image="${1:?usage: provision-postgres.sh <kolibri image reference>}"
config_dir=/home/gaulatti/.config/kolibri
url_file="$config_dir/database_url"
postgres_uid="$(id -u postgres)"
postgres_gid="$(id -g postgres)"

umask 077
mkdir -p "$config_dir"
if [ ! -e "$url_file" ]; then
  password="$(openssl rand -hex 32)"
  printf 'postgres://kolibri:%s@host.docker.internal:5432/kolibri\n' "$password" >"$url_file"
  unset password
fi
chmod 600 "$url_file"

docker run --rm -i \
  --network host \
  --user 0:0 \
  --security-opt label=disable \
  --env "POSTGRES_UID=$postgres_uid" \
  --env "POSTGRES_GID=$postgres_gid" \
  --volume /run/postgresql:/run/postgresql:ro \
  --volume "$url_file:/run/kolibri-database-url:ro" \
  --entrypoint node "$image" - <<'JS'
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const url = new URL(fs.readFileSync('/run/kolibri-database-url', 'utf8').trim());
  if (url.username !== 'kolibri' || !/^[a-f0-9]{64}$/.test(url.password)) {
    throw new Error('Unexpected Kolibri database URL');
  }
  process.setgid(Number(process.env.POSTGRES_GID));
  process.setuid(Number(process.env.POSTGRES_UID));
  const client = new Client({ host: '/run/postgresql', user: 'postgres', database: 'postgres' });
  await client.connect();
  try {
    const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'kolibri'");
    const database = await client.query("SELECT 1 FROM pg_database WHERE datname = 'kolibri'");
    if (role.rowCount !== 0 || database.rowCount !== 0) {
      if (role.rowCount === 1 && database.rowCount === 1) {
        console.log('Kolibri role and database already exist');
        return;
      }
      throw new Error('Partial Kolibri PostgreSQL setup; inspect before retrying');
    }
    await client.query(`CREATE ROLE kolibri LOGIN PASSWORD '${url.password}'`);
    await client.query('CREATE DATABASE kolibri OWNER kolibri');
    // The first migration creates pgcrypto, a trusted extension (PostgreSQL 13+), so the owner role may.
    console.log('Created Kolibri role and database');
  } finally {
    await client.end();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
JS

docker run --rm \
  --add-host host.docker.internal:host-gateway \
  --user 0:0 \
  --security-opt label=disable \
  --volume "$url_file:/run/kolibri-database-url:ro" \
  --entrypoint node "$image" \
  -e 'const fs=require("fs");const {Client}=require("pg");const c=new Client({connectionString:fs.readFileSync("/run/kolibri-database-url","utf8").trim(),ssl:false});c.connect().then(()=>c.query("SELECT 1")).then(()=>{console.log("Kolibri bridge connection verified");return c.end()}).catch(e=>{console.error(e.message);process.exit(1)})'
