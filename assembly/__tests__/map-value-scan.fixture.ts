import { JSON } from '../index';

@json
class Row { n:i32=7; text:string='default'; }

@json
class NumberToken {
  n:i32=0;
  @deserializer('number') decode(text:string):NumberToken {
    const out=new NumberToken();out.n=<i32>parseInt(text);return out;
  }
}

export function verify():i32 {
  const values=[
    'null','true','-12.5e2','"escaped \\\" } ] \\\\ end"',
    '[1,null,{"text":"日本語 } ]","nested":[true,false]}]',
    '{"a":[{"b":"[\\\"}]"}],"c":2}',
    '{"padding":"'+'日本語x'.repeat(160)+'","n":9}',
  ];
  let checks=0;
  for(let i=0;i<values.length;i++) {
    const source=' { "a" : '+values[i]+', "\\u0062": '+values[i]+' } ';
    const fresh=JSON.parse<Map<string,JSON.Raw>>(source);
    assert(fresh.size==2);
    assert(fresh.get('a').data==values[i]);
    assert(fresh.get('b').data==values[i]);
    const out=new Map<string,JSON.Raw>();out.set('stale',new JSON.Raw('0'));
    JSON.parse<Map<string,JSON.Raw>>(source,out);
    assert(out.size==2&&out.get('a').data==values[i]&&out.get('b').data==values[i]);
    checks++;
  }
  const rows=JSON.parse<Map<string,Row>>('{"a":{"text":"} ]","n":2},"b":{"n":3,"text":"x"}}');
  assert(rows.get('a').n==2&&rows.get('a').text=='} ]'&&rows.get('b').n==3);checks++;
  JSON.parse<Map<string,Row>>('{"a":{"n":4,"text":"y"}}',rows);
  assert(rows.size==1&&rows.get('a').n==4);checks++;
  const arrays=JSON.parse<Map<string,i32[]>>('{"a":[1,2],"b":[]}');
  assert(arrays.get('a').length==2&&arrays.get('a')[1]==2&&arrays.get('b').length==0);checks++;
  const tokens=JSON.parse<Map<string,NumberToken>>('{"a":13,"b":-7}');
  assert(tokens.get('a').n==13&&tokens.get('b').n==-7);checks++;
  return checks;
}
