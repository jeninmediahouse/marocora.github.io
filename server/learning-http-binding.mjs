import {networkInterfaces} from 'node:os';
import {isIP} from 'node:net';

// Trust only explicit local interface addresses, never an arbitrary Host header.
export function learningHttpBinding({host='127.0.0.1',port,interfaces=networkInterfaces()}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('INVALID_LOCAL_PORT');
 const addresses=[...new Set(Object.values(interfaces).flat().filter(item=>item&&item.family==='IPv4'&&!item.internal).map(item=>item.address))];
 if(isIP(host)!==4||!(host==='0.0.0.0'||host==='127.0.0.1'||addresses.includes(host)))throw Error('INVALID_LOCAL_HOST');
 const allowed=host==='0.0.0.0'?['127.0.0.1','localhost',...addresses]:host==='127.0.0.1'?['127.0.0.1','localhost']:[host];
 const origins=allowed.map(address=>'http://'+address+':'+port);
 const lan=addresses.find(address=>/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(address))||addresses[0];
 return {host,origins,linkOrigin:host==='0.0.0.0'&&lan?'http://'+lan+':'+port:origins[0]};
}
