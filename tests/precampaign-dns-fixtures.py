"""Synthetic DNS fixtures only. Never invokes dig or a provider."""
import pathlib
import runpy
import unittest
module = runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / 'ops/precampaign/dns-self-check.py'))
parse, collect = module['parse_answer'], module['collect']

class DNSFixtures(unittest.TestCase):
    def query(self, name, kind):
        self.calls.append((name, kind))
        values = {
            ('marocora.com', 'TXT'): ['"v=spf1 include:_spf.google.com ~all"'],
            ('_dmarc.marocora.com', 'TXT'): ['"v=DMARC1; p=none; rua=mailto:reports@fixture.invalid"'],
            ('auth.marocora.com', 'TXT'): [],
            ('send.auth.marocora.com', 'TXT'): ['"v=spf1 include:spf.fixture.invalid ~all"'],
            ('send.auth.marocora.com', 'MX'): ['10 feedback.fixture.invalid.'],
            ('synthetic._domainkey.auth.marocora.com', 'TXT'): ['"v=DKIM1; p=SYNTHETICPUBLICKEY"'],
            ('synthetic._domainkey.auth.marocora.com', 'CNAME'): [],
            ('marocora.com', 'MX'): ['1 smtp.google.com.']}
        text = ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 1\n' + '\n'.join(name + '. 300 IN ' + kind + ' ' + value for value in values.get((name, kind), []))
        return parse(text, name)

    def setUp(self): self.calls = []

    def test_expected_records(self):
        rows, records = collect('synthetic._domainkey.auth.marocora.com', 'send.auth.marocora.com', self.query)
        self.assertTrue(all(row[1] for row in rows));self.assertLessEqual(len(self.calls), 8)
        self.assertTrue(all(kind in ('TXT', 'CNAME', 'MX') for _, kind in self.calls))

    def test_unknown_selectors_are_not_guessed(self):
        rows, records = collect(query=self.query)
        self.assertFalse(rows[2][1]);self.assertFalse(rows[3][1]);self.assertEqual(len(self.calls), 4)

    def test_outside_domain_and_shell_input_rejected_before_any_lookup(self):
        for name in ('selector._domainkey.evil.invalid', 'x;curl.invalid', '--help', 'x.._domainkey.auth.marocora.com'):
            with self.assertRaises(ValueError): collect(name, query=self.query)
        self.assertEqual(self.calls, [])

    def test_multiple_spf_and_dns_failure_are_not_passes(self):
        def query(name, kind):
            record = self.query(name, kind)
            if name == 'marocora.com' and kind == 'TXT': record['records'].append(('TXT', '"v=spf1 -all"'))
            if name.startswith('_dmarc.'): record['ok'] = False
            return record
        rows, _ = collect(query=query);self.assertFalse(rows[0][1]);self.assertFalse(rows[1][1])

    def test_split_txt_is_one_rr_and_unrelated_answer_is_not_used(self):
        record = parse(';; status: NOERROR\nmarocora.com. 300 IN TXT "v=spf1 " "include:_spf.google.com ~all"\nevil.invalid. 300 IN TXT "v=spf1 -all"', 'marocora.com')
        self.assertEqual(module['txt'](record), ['v=spf1 include:_spf.google.com ~all'])

    def test_timeout_servfail_is_not_absence_or_success(self):
        for source in ('', ';; status: SERVFAIL'):
            self.assertFalse(parse(source, 'marocora.com')['ok'])

if __name__ == '__main__': unittest.main()
