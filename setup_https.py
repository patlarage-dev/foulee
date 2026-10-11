#!/usr/bin/env python3
"""Create a private local CA and an iPhone-compatible LAN server certificate."""
import argparse
import ipaddress
import os
from pathlib import Path
import re
import subprocess


def setup(hosts, destination):
    names = []
    for host in dict.fromkeys([*hosts, 'localhost', '127.0.0.1']):
        try:
            names.append('IP:' + str(ipaddress.ip_address(host)))
        except ValueError:
            if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?', host):
                raise ValueError('Utilise un nom de machine ou une adresse IP, sans http:// ni port.')
            names.append('DNS:' + host)
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(destination, 0o700)
    def run(*args):
        subprocess.run(['openssl', *args], cwd=destination, check=True, capture_output=True)
    ca_key, ca_cert = destination / 'ca.key', destination / 'ca.crt'
    if ca_key.exists() != ca_cert.exists():
        raise ValueError('Autorité locale incomplète : restaure les fichiers ca.key et ca.crt.')
    old_umask = os.umask(0o077)
    try:
        if not ca_key.exists():
            (destination / 'ca.cnf').write_text('[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ca\n[dn]\nCN=Foulee Local\n[ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\n')
            run('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '3650', '-config', 'ca.cnf', '-keyout', 'ca.key', '-out', 'ca.crt')
        (destination / 'server.cnf').write_text('[req]\nprompt=no\ndistinguished_name=dn\n[dn]\nCN=Foulee\n[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=' + ','.join(names) + '\n')
        run('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-config', 'server.cnf', '-keyout', 'server.key', '-out', 'server.csr')
        run('x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-days', '365', '-sha256', '-extfile', 'server.cnf', '-extensions', 'server', '-out', 'server.crt')
        run('x509', '-in', 'ca.crt', '-outform', 'DER', '-out', 'Foulee-Local.cer')
    finally:
        os.umask(old_umask)
    print(f'Certificat à transférer par AirDrop sur l’iPhone : {destination / "Foulee-Local.cer"}')
    print(f'Adresse : https://{hosts[0]}:8766/ (après redémarrage du serveur)')
    print('Installe le certificat puis active sa confiance dans Réglages > Général > Informations > Réglages des certificats.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('hosts', nargs='+', help='Nom .local du Mac et/ou IP utilisée sur iPhone')
    args = parser.parse_args()
    setup(args.hosts, Path(__file__).resolve().parent / '.https')
