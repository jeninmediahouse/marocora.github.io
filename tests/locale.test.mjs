import {searchCatalog} from '../learn/catalog.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {strings} from '../learn/i18n.mjs';
import {launchCopy} from '../learn/launch-copy.mjs';
import {instructorCopy} from '../learn/instructor-copy.mjs';
import {reviewCopy,fieldLabels} from '../learn/review-view.mjs';
import {locales,resolveLocale,applyLocale,captureFields,restoreFields,sharedCopy} from '../learn/locale.mjs';
import {taxonomy,canonicalSubject} from '../learn/taxonomy.mjs';
import {homeCopy} from '../home-copy.mjs';
import {readFileSync} from 'node:fs';
test('every authored learning and homepage label has all four interface translations',()=>{
 for(const dictionary of [strings,launchCopy,instructorCopy,reviewCopy,fieldLabels,sharedCopy])for(const lang of locales){assert.deepEqual(Object.keys(dictionary[lang]).sort(),Object.keys(dictionary.en).sort());for(const text of Object.values(dictionary[lang]))assert.ok(typeof text==='string'&&text.trim());}
 for(const row of [...taxonomy.categories,...taxonomy.subjects,...taxonomy.specialties])assert.deepEqual(Object.keys(row.name).sort(),[...locales].sort());
 for(const row of Object.values(homeCopy))assert.deepEqual(Object.keys(row).sort(),[...locales].sort());
 assert.equal(canonicalSubject('الرياضيات','الهندسة').id,'geometry');
 assert.equal(canonicalSubject('Ciencias','Física').id,'physics');
});
test('URL takes precedence, preference persists, storage denial still supports Arabic RTL',()=>{
 const store={value:'es',getItem(){return this.value;},setItem(key,value){assert.equal(key,'marocora.locale');this.value=value;}};
 assert.equal(resolveLocale('?lang=ar',store),'ar');assert.equal(resolveLocale('',store),'es');assert.equal(resolveLocale('?lang=de',store),'es');
 const doc={documentElement:{}};applyLocale('ar',doc,store);assert.deepEqual(doc.documentElement,{lang:'ar',dir:'rtl'});assert.equal(store.value,'ar');applyLocale('fr',doc,store);assert.equal(doc.documentElement.dir,'ltr');
 const denied={getItem(){throw Error();},setItem(){throw Error();}};assert.equal(resolveLocale('',denied),'en');assert.equal(applyLocale('ar',doc,denied),'ar');
});
test('language rerender preserves entered text, checkboxes, select values and open sections',()=>{
 const fields=[{id:'',name:'goals',type:'textarea',value:'أريد تعلم الجبر',checked:false},{id:'',name:'subjects',type:'checkbox',value:'algebra',checked:true},{id:'level',name:'',type:'select-one',value:'beginner'}];const details=[{open:true}];const root={querySelectorAll:selector=>selector==='details'?details:fields};const state=captureFields(root);fields[0].value='';fields[1].checked=false;fields[2].value='';details[0].open=false;restoreFields(root,state);assert.equal(fields[0].value,'أريد تعلم الجبر');assert.equal(fields[1].checked,true);assert.equal(fields[2].value,'beginner');assert.equal(details[0].open,true);
});
test('prepared student database accepts exactly the four interface languages',()=>{
 const sql=readFileSync(new URL('../supabase/learning_launch.sql',import.meta.url),'utf8');assert.match(sql,/check\(locale in \('en','ar','fr','es'\)\)/);assert.match(sql,/locale not in \('en','ar','fr','es'\)/);
});

test('subject search still matches the entered language after switching interfaces',()=>{
 const catalog={...taxonomy,instructors:[{id:'i',displayName:'Fixture',status:'active',subjects:[{subjectId:'algebra',approval:'approved'}],nativeLanguages:[],spokenLanguages:[],teachingStyles:[],verifications:[]}],offerings:[{id:'o',instructorId:'i',subjectId:'algebra',active:true,specialtyIds:[],levels:[],priceMinor:5000,currency:'MAD'}]};
 for(const locale of locales)for(const query of ['الجبر','Álgebra','Algebra','Algèbre'])assert.equal(searchCatalog(catalog,{query},locale).length,1);
 assert.equal(searchCatalog(catalog,{query:'الفيزياء'},'es').length,0);
});
