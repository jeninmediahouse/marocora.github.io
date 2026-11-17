// Local login tickets are distinct from LiveKit participant JWTs. Query tickets
// survive provider redirects; retain support for existing fragment-only links.
export function createLessonLogin({href,request,onAuthenticated=()=>{}}){
 const url=new URL(href),queries=url.searchParams.getAll('ticket'),fragment=url.hash.slice(1),ticket=queries.length?queries[0]:fragment,bookingId=url.searchParams.get('bookingId')||'';
 const invalid=queries.length>1||(queries.length&&(!/^[a-f0-9]{64}$/.test(ticket)||(fragment&&fragment!==ticket)));
 const ready=invalid?Promise.reject(Error('INVALID_MOCK_TICKET')):ticket?request('/api/local/learning-login',{ticket}).then(result=>{if(queries.length)onAuthenticated(ticket);return result;}):Promise.resolve();
 return {
  bookingId,ready,
  async join(room,id=bookingId){await ready;return room.connect(id);}
 };
}

// Read the current URL after acknowledgement so concurrent language changes
// survive. Do not clear a different ticket that arrived while login was pending.
export function lessonURLAfterLogin(href,ticket){
 const url=new URL(href);if(url.searchParams.get('ticket')!==ticket)return null;
 url.searchParams.delete('ticket');return url.pathname+url.search+url.hash;
}
