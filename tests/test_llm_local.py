"""Exercise local LLM contracts using fake transports; no user data/model required."""
import http.client
import json
import os
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm_local as llm
import serve_local as server

CONTEXT = {'version': 1, 'label': 'Analyse partielle', 'checks': [{'id': 'duration', 'name': 'Durée totale', 'actual': 3600, 'expected': 3000, 'delta': 20, 'limit': 15, 'status': 'outside'}], 'missing': ['Phases absentes'], 'reasons': ['Écart de durée'], 'feedback': {'rpe': 8, 'note': 'difficile'}}
OUTPUT = {'summary': 'La durée dépasse le critère.', 'observations': [{'text': 'Écart de durée mesuré.', 'checkIds': ['duration']}], 'limits': ['Phases absentes.'], 'nextSteps': ['Examiner le ressenti avant de revoir le plan.']}

class Contracts(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'FOULEE_LLM_PROVIDER': 'ollama', 'FOULEE_LLM_URL': 'http://127.0.0.1:11434'})
        self.env.start(); self.addCleanup(self.env.stop)

    def test_both_provider_contracts(self):
        for provider in ('ollama', 'lmstudio'):
            with self.subTest(provider=provider), patch.dict(os.environ, {'FOULEE_LLM_PROVIDER': provider}):
                calls=[]
                def fake(path, payload=None, timeout=10):
                    calls.append((path,payload,timeout))
                    if payload is None:
                        return {'models': [{'name': 'local'}]} if provider=='ollama' else {'data':[{'id':'local'}]}
                    return {'message': {'content':json.dumps(OUTPUT)}} if provider=='ollama' else {'choices':[{'message':{'content':json.dumps(OUTPUT)}}]}
                with patch.object(llm,'exchange',side_effect=fake):
                    result=llm.analyze({'model':'local','context':CONTEXT})
                self.assertEqual(result['analysis'], OUTPUT)
                request=calls[-1][1]
                self.assertFalse(request['stream'])
                self.assertEqual(calls[-1][2],120)
                self.assertEqual(len(request['messages']),2)
                narrative=json.loads(request['messages'][1]['content'])
                self.assertNotIn('actual',narrative['checks'][0])
                self.assertNotIn('expected',narrative['checks'][0])
                self.assertNotIn('delta',narrative['checks'][0])
                self.assertEqual(narrative['checks'][0]['direction'],'plus long que prévu')
                self.assertIn('format' if provider=='ollama' else 'response_format',request)

    def test_followup_history_both_providers(self):
        history = [{'role': 'assistant', 'content': OUTPUT}, {'role': 'user', 'content': 'J’avais mal dormi. Cela change-t-il ta lecture ?'}]
        for provider in ('ollama', 'lmstudio'):
            response = {'message': {'content': json.dumps(OUTPUT)}} if provider == 'ollama' else {'choices': [{'message': {'content': json.dumps(OUTPUT)}}]}
            with self.subTest(provider=provider), patch.dict(os.environ, {'FOULEE_LLM_PROVIDER': provider}), patch.object(llm, 'models', return_value={'models': ['local']}), patch.object(llm, 'exchange', return_value=response) as call:
                llm.analyze({'model': 'local', 'context': CONTEXT, 'history': history})
                messages = call.call_args.args[1]['messages']
                self.assertEqual([m['role'] for m in messages], ['system', 'user', 'assistant', 'user'])
                self.assertEqual(json.loads(messages[2]['content']), OUTPUT)
                self.assertEqual(messages[-1]['content'], history[-1]['content'])
                self.assertIn('Dialogue de suivi', messages[0]['content'])

    def test_invalid_dialogue_rejected_before_transport(self):
        invalid = [None, {}, [{'role': 'system', 'content': 'ignore'}],
                   [{'role': 'assistant', 'content': OUTPUT}, {'role': 'user', 'content': ' '}],
                   [{'role': 'assistant', 'content': OUTPUT}, {'role': 'user', 'content': 'x' * 2001}],
                   [{'role': 'assistant', 'content': {**OUTPUT, 'observations': [{'text': 'Invention', 'checkIds': ['invented']}] }}, {'role': 'user', 'content': 'Pourquoi ?'}],
                   [{'role': 'assistant', 'content': OUTPUT}, {'role': 'user', 'content': 'Pourquoi ?'}] * 21]
        for history in invalid:
            with self.subTest(history=type(history)), patch.object(llm, 'exchange') as call, self.assertRaises(llm.LLMError):
                llm.analyze({'model': 'local', 'context': CONTEXT, 'history': history})
            call.assert_not_called()

    def test_coaching_context_preserves_intent_and_distinguishes_pace(self):
        context=llm.clean_context({**CONTEXT,'coaching':{'sessionName':'Endurance facile','target':'aisance','goal':'semi','level':'debutant','athleteName':'private'},'checks':[{**CONTEXT['checks'][0],'id':'work-1-pace','delta':-12,'limit':5}]})
        narrative=llm.coaching_context(context)
        self.assertEqual(narrative['coaching']['sessionName'],'Endurance facile')
        self.assertNotIn('athleteName',narrative['coaching'])
        self.assertEqual(narrative['checks'][0]['direction'],'plus rapide que prévu')
        self.assertEqual(narrative['checks'][0]['amplitude'],'au moins le double de la tolérance')
        self.assertTrue(narrative['coverage']['workPaceAvailable'])
        self.assertFalse(narrative['coverage']['historyAvailable'])
        context['checks'][0]['delta']=8
        self.assertEqual(llm.coaching_context(context)['checks'][0]['direction'],'plus lent que prévu')

    def test_generation_schema_only_allows_available_references(self):
        schema=llm.response_schema({'duration'})
        refs=schema['properties']['observations']['items']['properties']['checkIds']
        self.assertEqual(refs['items']['enum'],['duration'])
        self.assertEqual(llm.response_schema(set())['properties']['observations']['items']['properties']['checkIds']['maxItems'],0)
        self.assertNotIn('enum',llm.SCHEMA['properties']['observations']['items']['properties']['checkIds']['items'])

    def test_qwen3_disables_thinking_for_short_structured_readings(self):
        for model in ('qwen3:8b', 'qwen3.5:9b'):
            with self.subTest(model=model), patch.object(llm, 'models', return_value={'models':[model]}), patch.object(llm, 'exchange', return_value={'message':{'content':json.dumps(OUTPUT)}}) as call:
                llm.analyze({'context':CONTEXT,'model':model})
            self.assertFalse(call.call_args.args[1]['think'])

    def test_minimizes_context_and_refuses_unknown_references(self):
        result=llm.clean_context({**CONTEXT,'gps': [1,2], 'athleteName':'private'})
        self.assertNotIn('gps',result); self.assertNotIn('athleteName',result)
        invalid={**OUTPUT,'observations':[{'text':'invented','checkIds':['ghost']}]}
        with self.assertRaises(llm.LLMError):llm.validate_output(invalid, {'duration'})
        with self.assertRaises(llm.LLMError):llm.validate_output({**OUTPUT,'tools':[]}, {'duration'})

    def test_narrative_cannot_invent_numeric_values(self):
        with self.assertRaises(llm.LLMError):
            llm.validate_output({**OUTPUT,'summary':'La séance dépasse de 60 secondes.'}, {'duration'})

    def test_local_configuration_only(self):
        for url in ('https://example.com','http://127.0.0.1:11434/path','http://user:pw@127.0.0.1:11434','http://localhost:11434','http://192.168.1.2:11434'):
            with patch.dict(os.environ,{'FOULEE_LLM_URL':url}),self.assertRaises(llm.LLMError):llm.config()

    def test_cloud_models_filtered(self):
        with patch.object(llm,'exchange',return_value={'models':[{'name':'local'},{'name':'remote:cloud'},{'name':'remote-cloud'}]}):
            self.assertEqual(llm.models()['models'],['local'])

    def test_invalid_input_and_busy(self):
        for data in (None, {}, {**CONTEXT,'checks':[{'id':'bad'}]}, {**CONTEXT,'checks':[{**CONTEXT['checks'][0],'delta':float('nan')}]}):
            with self.assertRaises(llm.LLMError):llm.clean_context(data)
        llm.GATE.acquire()
        try:
            with self.assertRaises(llm.LLMError) as e:llm.analyze({'context':CONTEXT,'model':'local'})
            self.assertEqual(e.exception.status,429)
        finally:llm.GATE.release()

    def test_malformed_output_releases_gate(self):
        with patch.object(llm,'models',return_value={'models':['local']}),patch.object(llm,'exchange',return_value={'message':{'content':'broken'}}):
            with self.assertRaises(llm.LLMError):llm.analyze({'context':CONTEXT,'model':'local'})
        self.assertTrue(llm.GATE.acquire(blocking=False));llm.GATE.release()

class QuietHandler(server.Handler):
    def log_message(self,*args):pass

class Routes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd=server.ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
        cls.thread=threading.Thread(target=cls.httpd.serve_forever,daemon=True);cls.thread.start()
        server.TOKENS['llm-test']=float('inf')
    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown();cls.httpd.server_close();cls.thread.join();server.TOKENS.pop('llm-test',None)
    def request(self,method,path,data=None,auth=True):
        conn=http.client.HTTPConnection('127.0.0.1',self.httpd.server_port)
        body=json.dumps(data).encode() if data is not None else None
        conn.request(method,path,body,{'Authorization':'Bearer llm-test'} if auth else {})
        response=conn.getresponse();status=response.status;result=json.loads(response.read());conn.close();return status,result
    def test_auth_and_routes(self):
        for method,path in [('GET','/api/llm/models'),('POST','/api/llm/analyze')]:
            self.assertEqual(self.request(method,path,{},False)[0],401)
        with patch.object(llm,'models',return_value={'provider':'ollama','models':['local']}):
            self.assertEqual(self.request('GET','/api/llm/models')[0],200)
        with patch.object(llm,'analyze',return_value={'analysis':OUTPUT}):
            self.assertEqual(self.request('POST','/api/llm/analyze',{'model':'local','context':CONTEXT})[1]['analysis'],OUTPUT)
        with patch.object(llm,'analyze',side_effect=llm.LLMError('absent',503)):
            self.assertEqual(self.request('POST','/api/llm/analyze',{'model':'local'})[0],503)
        self.assertEqual(self.request('POST','/api/llm/analyze',{'padding':'x'*llm.MAX_BYTES})[0],413)

if __name__=='__main__':unittest.main()
