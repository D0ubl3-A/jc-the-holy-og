/* JC clean-rap rule: check only JC's submitted/spoken words, not rival text. */
(function(root){
  'use strict';
  const BAD=new Set([
    'fuck','fucks','fucked','fucker','fuckers','fucking','motherfucker','motherfuckers',
    'shit','shits','shitty','bullshit','horseshit','dipshit',
    'bitch','bitches','bitchy','sonofabitch',
    'ass','asses','asshole','assholes','jackass','dumbass','badass',
    'cunt','cunts','cock','cocks','dick','dicks','pussy','pussies',
    'bastard','bastards','damn','damned','goddamn','goddamned',
    'hell','crap','crappy','piss','pissed','pissing',
    'slut','sluts','whore','whores','wanker','wankers',
    'nigger','niggers','nigga','niggas',
    'fag','faggot','faggots'
  ]);
  const substitutions={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i','+':'t'};
  function normalizeWord(value){
    const chars=String(value||'').normalize('NFKC').toLowerCase().replace(/[\u200b-\u200d\u2060\ufeff]/g,'').split('');
    return chars.map(c=>substitutions[c]||c).join('').replace(/[^a-z]/g,'');
  }
  function detectProfanity(value){
    const text=String(value||'').normalize('NFKC').toLowerCase().replace(/[\u200b-\u200d\u2060\ufeff]/g,'');
    const parts=text.match(/[^\s]+/g)||[];
    for(const part of parts){
      const word=normalizeWord(part);
      if(BAD.has(word))return {detected:true,word};
    }
    // Catch deliberately separated individual letters without combining ordinary words.
    const separated=text.match(/(?:^|\s)(?:[a-z][\s.\-_]+){2,}[a-z](?=\s|$)/g)||[];
    for(const sequence of separated){
      const joined=normalizeWord(sequence);
      if(BAD.has(joined))return {detected:true,word:joined};
    }
    return {detected:false,word:null};
  }
  const api={detectProfanity,normalizeWord};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JCRapGuard=api;
})(typeof globalThis!=='undefined'?globalThis:this);
