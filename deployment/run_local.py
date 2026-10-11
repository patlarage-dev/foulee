#!/usr/bin/env python3
"""Run Foulée against disposable local data, separate from the Mac's real database."""
import argparse
import os
from pathlib import Path
import runpy
import sys
import tempfile
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--port', type=int, default=8875)
a = p.parse_args()
with tempfile.TemporaryDirectory(prefix='foulee-dev-') as home:
    os.environ['HOME'] = home
    os.environ['FOULEE_PORT'] = str(a.port)
    os.environ['FOULEE_TLS_CERT'] = str(Path(home) / 'unused.crt')
    os.environ['FOULEE_TLS_KEY'] = str(Path(home) / 'unused.key')
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    print('Données de test temporaires supprimées à la fermeture :', home, flush=True)
    runpy.run_path(str(Path(__file__).resolve().parents[1] / 'serve_local.py'), run_name='__main__')
