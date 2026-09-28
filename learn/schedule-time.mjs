// datetime-local is interpreted in the device zone, which the UI displays.
// Reject invalid dates and daylight-saving jumps/duplicates instead of moving them.
export function localDateTime(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('INVALID_LOCAL_TIME');
 const d=new Date(value),pad=n=>String(n).padStart(2,'0');
 const display=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
 if(!Number.isFinite(d.valueOf())||display(d)!==value)throw new Error('INVALID_LOCAL_TIME');
 for(const delta of [-7200000,-3600000,-1800000,1800000,3600000,7200000])if(display(new Date(d.valueOf()+delta))===value)throw new Error('AMBIGUOUS_LOCAL_TIME');
 return d.toISOString();
}
