export type CodeInput = { id:number; title:string; supplier?:string; ivt?:boolean; view?:boolean; codeType?:string; };
export type BuiltCode = { kind:'vast'|'mraid'|'audit'; text:string };
export function buildCode(i: CodeInput): BuiltCode {
  const t=(i.codeType||'').toLowerCase();
  if (t.includes('vast')) {
    const url=`https://demo.adriver.local/vast?pid=${i.id}&sup=${encodeURIComponent(i.supplier||'unknown')}&ivt=${i.ivt?'1':'0'}&view=${i.view?'1':'0'}&type=${encodeURIComponent(i.codeType||'')}`;
    return {kind:'vast', text:`<VASTAdTagURI><![CDATA[${url}]]></VASTAdTagURI>`};
  }
  if (t.includes('mraid')) {
    const url=`https://demo.adriver.local/mraid?pid=${i.id}&sup=${encodeURIComponent(i.supplier||'unknown')}&type=${encodeURIComponent(i.codeType||'')}`;
    return {kind:'mraid', text:`mraid.open('${url}')`};
  }
  const px=`https://demo.adriver.local/audit?pid=${i.id}&sup=${encodeURIComponent(i.supplier||'unknown')}&ivt=${i.ivt?'1':'0'}&view=${i.view?'1':'0'}&type=${encodeURIComponent(i.codeType||'')}`;
  return {kind:'audit', text:px};
}
