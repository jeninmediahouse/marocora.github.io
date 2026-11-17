export const SWORN_SERVICE='Sworn Translation (Morocco)';
export const IN_PERSON='This is an in-person hand-off. The translator will validate the physical original document in person before handing over the stamped and notarized translation.';
export const GUARANTEE='Marocora stands by our sworn translations. If any Moroccan government authority rejects this translation and demands changes, we will amend or redo it for you.';
export const USB_WARNING='The flash drive will be encrypted for your security. The decryption password will be sent to your email address. Do not lose the password.';
export const SHIPPING_WARNING='Shipping charges are extra.';
export const USB_COST_WARNING='Shipping plus the cost of the flash drive is extra.';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function validateDOB(value){
 const match=typeof value==='string'&&new RegExp('^('+months.join('|')+') ([1-9]|[12][0-9]|3[01]) ([0-9]{4})$').exec(value);
 if(!match||match[0]!==value)throw Error('DOB_FORMAT: Use August 1 1960, with the full English month name.');
 const month=months.indexOf(match[1]),day=Number(match[2]),year=Number(match[3]),date=new Date(0);date.setUTCFullYear(year,month,day);date.setUTCHours(0,0,0,0);
 if(year<1||date.getUTCMonth()!==month||date.getUTCDate()!==day||date>Date.now())throw Error('DOB_INVALID');return value;
}
