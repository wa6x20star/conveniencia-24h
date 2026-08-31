import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
const root=fileURLToPath(new URL('../',import.meta.url));
process.on('uncaughtException',error=>{console.error(error.message);process.exit(1);});
const db=new PGlite();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', email text);
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function auth.role() returns text language sql as $$ select 'service_role'::text $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;`);
for(const file of ['V4_INSTALL.sql','V5_STOCK_CONTROL.sql','V6_4_SECURITY_HARDENING.sql','V6_5_LOGISTICS.sql','V6_6_ORDER_TRACKING.sql','V6_7_DRIVER_PANEL.sql','V6_8_DRIVER_PAYOUTS.sql','V6_8_1_DELIVERY_CONFIRMATION.sql','V6_8_4_CANCELAMENTOS.sql']) {
 try {await db.exec(read('supabase/'+file).replace(/create extension if not exists[^;]+;/gi,'')); console.log('Migration OK:',file);}
 catch(e) {console.error('Migration FAILED:',file,e.message);process.exit(1);}
}
await db.exec(read('supabase/V6_8_4_CANCELAMENTOS.sql'));
console.log('Migration rerun OK');
const actor=randomUUID(), driverUser=randomUUID(), store=randomUUID(), product=randomUUID(), sp=randomUUID(), driver=randomUUID();
await db.query(`insert into auth.users(id) values($1),($2)`,[actor,driverUser]);
await db.query(`insert into public.stores(id,name,slug) values($1,'Teste V684','v684-test')`,[store]);
await db.query(`insert into public.products(id,sku,name) values($1,'v684-test','Produto de teste')`,[product]);
await db.query(`insert into public.store_products(id,store_id,product_id,price) values($1,$2,$3,10)`,[sp,store,product]);
await db.query(`insert into public.inventory(store_product_id,on_hand,reserved) values($1,10,0)`,[sp]);
await db.query(`insert into public.drivers(id,user_id,store_id,status) values($1,$2,$3,'available')`,[driver,driverUser,store]);
await db.query(`insert into public.driver_payout_settings(store_id,control_started_at) values($1,now()-interval '1 day')`,[store]);
const publicId=(await db.query('select public_id from public.products where id=$1',[product])).rows[0].public_id;
const q=(s,p=[])=>db.query(s,p);
const row=async(s,p=[])=> (await q(s,p)).rows[0];
const stock=()=>row('select on_hand,reserved from public.inventory where store_product_id=$1',[sp]);
const order=async()=>{
 const payload={store_slug:'v684-test',client_order_key:randomUUID(),payment_method:'pix',delivery_fee:7,driver_payout:5,delivery_distance_km:2,delivery_quote_source:'test',customer:{name:'Cliente Teste',phone:'81999999999'},address:{postal_code:'00000000',street:'Rua Teste',number:'1',neighborhood:'Teste',city:'Teste',state:'PE'},items:[{product_id:Number(publicId),quantity:2}]};
 const r=await row('select public.create_order_v681($1::jsonb,$2) as result',[JSON.stringify(payload),'a'.repeat(64)]);
 return r.result.id;
};
const advance=async(id,to='ready')=>{
 await q(`select public.set_order_status_v64($1,'picking',null,$2)`,[id,actor]);
 if(to==='ready') await q(`select public.set_order_status_v64($1,'ready',null,$2)`,[id,actor]);
};
const assign=async(id,start=false)=>{
 const r=await row('select public.assign_delivery_v65($1,$2,$3) as result',[id,driver,actor]);
 if(start) await q(`select public.set_delivery_status_v65($1,'started',$2)`,[r.result.id,driverUser]);
 return r.result.id;
};
const cancel=(id,returned=false)=>q('select public.cancel_order_v684($1,$2,$3,$4)',[id,'Cliente solicitou cancelamento',actor,returned]);
async function rejects(s,p,message) {
 await db.exec('savepoint expected_error');
 try {await q(s,p);assert.fail('Expected error '+message);} catch(e){assert.match(e.message,new RegExp(message));}
 finally{await db.exec('rollback to savepoint expected_error; release savepoint expected_error');}
}
let passed=0;
async function test(name,fn){
 await db.exec('begin');
 try{await fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.message);throw e;}
 finally{await db.exec('rollback');}
}
await test('Received: release reservation once; actor, time, history and unpaid status',async()=>{
 const id=await order();assert.deepEqual(await stock(),{on_hand:10,reserved:2});
 await cancel(id);await cancel(id);assert.deepEqual(await stock(),{on_hand:10,reserved:0});
 const o=await row('select * from public.orders where id=$1',[id]);assert.equal(o.cancelled_by,actor);assert.ok(o.cancelled_at);assert.equal(o.payment_status,'cancelled');assert.equal(o.refund_status,'not_required');
 assert.equal(Number((await row("select count(*) n from public.audit_logs where entity_id=$1 and action='order_cancelled'",[id])).n),1);
});
await test('Picking: release only own reservation; another order remains reserved',async()=>{
 const id=await order();await order();await advance(id,'picking');await cancel(id);assert.deepEqual(await stock(),{on_hand:10,reserved:2});
});
await test('Ready: restore physical stock once and record movement',async()=>{
 const id=await order();await advance(id);assert.deepEqual(await stock(),{on_hand:8,reserved:0});await cancel(id);await cancel(id);assert.deepEqual(await stock(),{on_hand:10,reserved:0});
 assert.equal(Number((await row("select sum(quantity) n from public.inventory_movements where order_id=$1",[id])).n),0);
});
await test('Required reason: empty, whitespace, short and too long rejected',async()=>{
 const id=await order();for(const reason of ['', '   ','ab','x'.repeat(301)]) await rejects('select public.cancel_order_v684($1,$2,$3)',[id,reason,actor],'cancellation_reason_required');
 assert.deepEqual(await stock(),{on_hand:10,reserved:2});
});
await test('Assigned delivery ends with zero payout and driver becomes available',async()=>{
 const id=await order();await advance(id);const delivery=await assign(id);await cancel(id);
 const d=await row('select * from public.deliveries where id=$1',[delivery]);assert.equal(d.status,'cancelled');assert.equal(Number(d.driver_payout),0);
 assert.equal((await row('select status from public.drivers where id=$1',[driver])).status,'available');
 await rejects('select public.create_driver_payout_v68($1,$2,$3,\'pix\',now(),null,null,$4)',[store,driver,[delivery],actor],'payout_order_not_completed');
 await rejects('select public.assign_delivery_v65($1,$2,$3)',[id,driver,actor],'order_not_ready');
});
await test('In transit: require returned stock and reject subsequent code, proof and start',async()=>{
 const id=await order();await advance(id);const delivery=await assign(id,true);
 await rejects('select public.cancel_order_v684($1,$2,$3)',[id,'Cancelamento',actor],'stock_return_confirmation_required');
 assert.deepEqual(await stock(),{on_hand:8,reserved:0});await cancel(id,true);assert.deepEqual(await stock(),{on_hand:10,reserved:0});
 await rejects('select public.confirm_delivery_code_v681($1,$2,true,$3)',[delivery,'a'.repeat(64),driverUser],'order_is_final');
 await rejects('select public.submit_delivery_proof_v684($1,$2,$3,null,true,$4)',[delivery,'test/photo.jpg','code_unavailable',driverUser],'delivery_not_started');
 await rejects("select public.set_delivery_status_v65($1,'started',$2)",[delivery,driverUser],'order_is_final');
});
await test('Paid order: refund pending, paid record preserved and manual refund idempotent',async()=>{
 const id=await order();await q("update public.orders set payment_status='paid' where id=$1",[id]);await q("update public.payments set status='paid',paid_at=now() where order_id=$1",[id]);await cancel(id);
 const o=await row('select * from public.orders where id=$1',[id]);assert.equal(o.refund_status,'pending');assert.equal(Number(o.refund_amount),27);assert.equal(o.refunded_at,null);assert.equal(o.payment_status,'paid');
 assert.equal((await row('select status from public.payments where order_id=$1',[id])).status,'paid');
 await rejects('select public.complete_order_refund_v684($1,$2,$3)',[id,' ',actor],'refund_reference_required');
 await q('select public.complete_order_refund_v684($1,$2,$3)',[id,'Comprovante externo TESTE-001',actor]);await q('select public.complete_order_refund_v684($1,$2,$3)',[id,'Tentativa repetida',actor]);
 const after=await row('select * from public.orders where id=$1',[id]);assert.equal(after.refund_status,'completed');assert.equal(after.refund_reference,'Comprovante externo TESTE-001');assert.equal(after.refunded_by,actor);
 assert.equal(Number((await row("select count(*) n from public.audit_logs where entity_id=$1 and action='order_refund_completed'",[id])).n),1);
});
await test('Payment-table-only paid state is detected',async()=>{
 const id=await order();await q("update public.payments set status='paid' where order_id=$1",[id]);await cancel(id);assert.equal((await row('select refund_status from public.orders where id=$1',[id])).refund_status,'pending');
});
await test('Proof reported payment received: refund pending and proof no longer actionable',async()=>{
 const id=await order();await advance(id);const delivery=await assign(id,true);
 await q('select public.submit_delivery_proof_v684($1,$2,$3,null,true,$4)',[delivery,'test/photo.jpg','code_unavailable',driverUser]);
 await cancel(id,true);assert.equal((await row('select refund_status from public.orders where id=$1',[id])).refund_status,'pending');
 assert.equal((await row('select status from public.delivery_confirmations where order_id=$1',[id])).status,'proof_rejected');
 await rejects('select public.approve_delivery_proof_v681($1,null,$2)',[delivery,actor],'order_is_final');
});
await test('Normal delivery by code and payout still work; delivered cancellation blocked',async()=>{
 const id=await order();await advance(id);const delivery=await assign(id,true);
 const bad=await row('select public.confirm_delivery_code_v681($1,$2,true,$3) r',[delivery,'b'.repeat(64),driverUser]);assert.equal(bad.r.error,'invalid_confirmation_code');
 const ok=await row('select public.confirm_delivery_code_v681($1,$2,true,$3) r',[delivery,'a'.repeat(64),driverUser]);assert.equal(ok.r.ok,true);
 await rejects('select public.cancel_order_v684($1,$2,$3,true)',[id,'Cancelamento',actor],'cannot_cancel_delivered');
 await q("select public.create_driver_payout_v68($1,$2,$3,'pix',now(),null,null,$4)",[store,driver,[delivery],actor]);
 assert.equal(Number((await row('select amount from public.driver_payout_items where delivery_id=$1',[delivery])).amount),5);
 assert.deepEqual(await stock(),{on_hand:8,reserved:0});
});
await test('Normal proof approval still works; post-confirmation cancel blocked',async()=>{
 const id=await order();await advance(id);const delivery=await assign(id,true);
 await q('select public.submit_delivery_proof_v684($1,$2,$3,null,true,$4)',[delivery,'test/photo.jpg','code_unavailable',driverUser]);
 await q('select public.approve_delivery_proof_v681($1,null,$2)',[delivery,actor]);
 await rejects('select public.cancel_order_v684($1,$2,$3,true)',[id,'Cancelamento',actor],'cannot_cancel_delivered');
});
await test('Expiry uses cancellation once and marks paid refund pending',async()=>{
 const id=await order();await q("update public.orders set reservation_expires_at=now()-interval '1 minute',payment_status='paid' where id=$1",[id]);
 await q('select public.expire_stale_orders_v64()');await q('select public.expire_stale_orders_v64()');
 const o=await row('select * from public.orders where id=$1',[id]);assert.equal(o.cancellation_source,'reservation_expired');assert.equal(o.cancelled_by,null);assert.equal(o.refund_status,'pending');assert.deepEqual(await stock(),{on_hand:10,reserved:0});
});
await test('Stock inconsistency rolls back all cancellation changes',async()=>{
 const id=await order();await q('update public.inventory set reserved=0 where store_product_id=$1',[sp]);
 await rejects('select public.cancel_order_v684($1,$2,$3)',[id,'Cancelamento',actor],'stock_release_failed');
 assert.equal((await row('select status from public.orders where id=$1',[id])).status,'received');assert.equal(Number((await row("select count(*) n from public.audit_logs where action='order_cancelled' and entity_id=$1",[id])).n),0);
});
await test('No rewinding to received; legacy cancellation requires reason',async()=>{
 const id=await order();await advance(id,'picking');
 await rejects("select public.set_order_status_v64($1,'received',null,$2)",[id,actor],'invalid_transition');
 await rejects("select public.set_order_status_v4($1,'cancelled',null,$2)",[id,actor],'cancellation_reason_required');
});
await test('Unassigning delivery keeps order ready and stock consumed',async()=>{
 const id=await order();await advance(id);const delivery=await assign(id);await q("select public.set_delivery_status_v65($1,'cancelled',$2)",[delivery,actor]);
 assert.equal((await row('select status from public.orders where id=$1',[id])).status,'ready');assert.deepEqual(await stock(),{on_hand:8,reserved:0});await assign(id);
});
await test('Public roles cannot execute cancellation, refund or proof RPCs',async()=>{
 for(const role of ['anon','authenticated']) for(const signature of ['cancel_order_v684(uuid,text,uuid,boolean,text)','complete_order_refund_v684(uuid,text,uuid)','submit_delivery_proof_v684(uuid,text,text,text,boolean,uuid)']){
  assert.equal((await row('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,'public.'+signature])).allowed,false);
 }
});
console.log('ALL PASSED:',passed,'transactional scenarios (isolated PGlite; not a multi-connection concurrency test)');
await db.close();
