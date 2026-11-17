-- Instant Pricing V3. Apply after the translation workflow/owner seed.
-- Mock payments only. No processor, money movement, email or live scanner.
BEGIN;
CREATE TABLE public.instant_orders(
 id uuid PRIMARY KEY,customer_id uuid NOT NULL REFERENCES auth.users(id),provider_id uuid REFERENCES auth.users(id),
 category text NOT NULL CHECK(category IN ('normal','technical','legal','medical','sworn')),
 source_language text NOT NULL,target_language text NOT NULL CHECK(source_language<>target_language),
 counted_words integer,billable_words integer,page_count integer,
 sample_requested boolean NOT NULL DEFAULT false,scanned boolean NOT NULL DEFAULT false,
 first_order boolean NOT NULL DEFAULT false,
 subtotal_minor bigint,vat_minor bigint,total_minor bigint,deposit_minor bigint,balance_minor bigint,
 status text NOT NULL CHECK(status IN ('manual_review','quoted','in_progress_deposit_paid','awaiting_balance','paid_in_full')),
 original_file jsonb NOT NULL,final_file jsonb,draft_file jsonb,
 originals_presented_at timestamptz,delivery_date date,consent_text text,consent_version text,consent_at timestamptz,work_started_at timestamptz,completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(total_minor IS NULL OR (subtotal_minor>=15000 AND vat_minor>=0 AND total_minor=subtotal_minor+vat_minor AND total_minor=deposit_minor+balance_minor)),
 CHECK(status NOT IN ('awaiting_balance','paid_in_full') OR (final_file IS NOT NULL AND draft_file IS NOT NULL AND work_started_at IS NOT NULL))
);
CREATE TABLE public.instant_mock_payments(
 command_id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.instant_orders(id),
 phase text NOT NULL CHECK(phase IN ('deposit','balance')),amount_minor bigint NOT NULL CHECK(amount_minor>0),
 customer_id uuid NOT NULL REFERENCES auth.users(id),gateway text NOT NULL DEFAULT 'MOCK' CHECK(gateway='MOCK'),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(order_id,phase)
);
CREATE TABLE public.instant_order_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.instant_orders(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),kind text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instant_mock_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instant_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY instant_rpc_only ON public.instant_orders AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY instant_rpc_only ON public.instant_mock_payments AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY instant_rpc_only ON public.instant_order_events AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.instant_orders,public.instant_mock_payments,public.instant_order_events FROM public,anon,authenticated,service_role;
CREATE TRIGGER instant_payments_immutable BEFORE UPDATE OR DELETE ON public.instant_mock_payments FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();
CREATE TRIGGER instant_events_immutable BEFORE UPDATE OR DELETE ON public.instant_order_events FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();

CREATE FUNCTION public.instant_price(p_category text,p_words integer,p_pages integer,p_first boolean) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE quantity bigint;rate bigint;raw bigint;subtotal bigint;total bigint;deposit bigint;
BEGIN
 PERFORM public.quote_assert(p_category IN ('normal','technical','legal','medical','sworn'),'INVALID_CATEGORY');
 IF p_category='sworn' THEN
  PERFORM public.quote_assert(p_pages BETWEEN 1 AND 10000,'INVALID_PAGE_COUNT');quantity:=p_pages;rate:=15000;
 ELSE
  PERFORM public.quote_assert(p_words BETWEEN 1 AND 10000000,'INVALID_WORD_COUNT');quantity:=floor(p_words::numeric*98/100);rate:=CASE p_category WHEN 'normal' THEN 70 WHEN 'technical' THEN 95 WHEN 'legal' THEN 110 WHEN 'medical' THEN 105 END;
 END IF;
 raw:=quantity*rate;subtotal:=greatest(15000,CASE WHEN p_first THEN round(raw::numeric*90/100)::bigint ELSE raw END);
 total:=round(subtotal::numeric*120/100);deposit:=ceil(total::numeric/2);
 RETURN jsonb_build_object('counted_words',p_words,'billable_words',CASE WHEN p_category='sworn' THEN NULL ELSE quantity END,'page_count',p_pages,'subtotal_minor',subtotal,'vat_minor',total-subtotal,'total_minor',total,'deposit_minor',deposit,'balance_minor',total-deposit);
END;$$;
CREATE FUNCTION public.instant_delivery_date(p_words integer,p_pages integer) RETURNS date LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT d::date FROM generate_series(current_date+1,current_date+(greatest(1,ceil(coalesce(p_words,p_pages*250,2000)::numeric/2000)::integer)*2+14),interval '1 day') d
 WHERE extract(isodow FROM d)<6 ORDER BY d OFFSET greatest(1,ceil(coalesce(p_words,p_pages*250,2000)::numeric/2000)::integer)-1 LIMIT 1;$$;
CREATE FUNCTION public.instant_gate() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.quote_assert((SELECT capture_enabled AND commands_enabled FROM public.quote_settings WHERE singleton),'COMMANDS_DISABLED');
END;$$;
CREATE FUNCTION public.instant_detail(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.instant_orders;actor uuid:=auth.uid();
BEGIN
 PERFORM public.quote_assert(public.quote_verified(actor),'UNAVAILABLE');
 SELECT * INTO q FROM public.instant_orders WHERE id=p_id;
 PERFORM public.quote_assert(q.id IS NOT NULL AND (q.customer_id=actor OR q.provider_id=actor OR public.quote_staff(actor)),'UNAVAILABLE');
 RETURN to_jsonb(q);
END;$$;
CREATE FUNCTION public.instant_list() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC),'[]'::jsonb) FROM public.instant_orders q
 WHERE public.quote_verified(auth.uid()) AND (customer_id=auth.uid() OR provider_id=auth.uid() OR public.quote_staff(auth.uid()));$$;
CREATE FUNCTION public.instant_providers() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.quote_assert(public.quote_verified(auth.uid()) AND public.quote_staff(auth.uid()),'STAFF_OWNER_REQUIRED');
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.provider_id,'name',u.email)),'[]'::jsonb) FROM public.quote_provider_readiness r JOIN auth.users u ON u.id=r.provider_id WHERE r.state='enabled' AND public.quote_verified(r.provider_id));
END;$$;
CREATE FUNCTION public.instant_record_order(p_actor uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE new_id uuid:=(p_payload->>'id')::uuid;first_order boolean;price jsonb;manual boolean:=(p_payload->>'manualReview')::boolean;languages text[]:=ARRAY['Arabic','Chinese (Mandarin)','English','French','German','Portuguese','Russian','Spanish','Turkish'];
BEGIN
 PERFORM public.instant_gate();
 PERFORM public.quote_assert(auth.role()='service_role' AND public.quote_verified(p_actor) AND NOT public.quote_staff(p_actor) AND NOT EXISTS(SELECT 1 FROM public.quote_provider_readiness WHERE provider_id=p_actor AND state='enabled'),'CUSTOMER_REQUIRED');
 PERFORM public.quote_assert(p_payload->>'source'=ANY(languages) AND p_payload->>'target'=ANY(languages) AND p_payload->>'source'<>p_payload->>'target','INVALID_LANGUAGE_PAIR');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,776));
 first_order:=NOT EXISTS(SELECT 1 FROM public.instant_mock_payments WHERE customer_id=p_actor AND phase='deposit');
 IF NOT manual THEN price:=public.instant_price(p_payload->>'category',(p_payload->>'words')::integer,(p_payload->>'pages')::integer,first_order); END IF;
 INSERT INTO public.instant_orders(id,customer_id,category,source_language,target_language,counted_words,billable_words,page_count,sample_requested,scanned,first_order,subtotal_minor,vat_minor,total_minor,deposit_minor,balance_minor,status,original_file)
 VALUES(new_id,p_actor,p_payload->>'category',p_payload->>'source',p_payload->>'target',(p_payload->>'words')::integer,(price->>'billable_words')::integer,(p_payload->>'pages')::integer,(p_payload->>'sampleRequested')::boolean,(p_payload->>'scanned')::boolean,first_order,(price->>'subtotal_minor')::bigint,(price->>'vat_minor')::bigint,(price->>'total_minor')::bigint,(price->>'deposit_minor')::bigint,(price->>'balance_minor')::bigint,CASE WHEN manual THEN 'manual_review' ELSE 'quoted' END,p_payload->'file');
 UPDATE public.instant_orders SET delivery_date=CASE WHEN manual THEN NULL ELSE public.instant_delivery_date((p_payload->>'words')::integer,(p_payload->>'pages')::integer) END WHERE instant_orders.id=new_id;
 INSERT INTO public.instant_order_events(order_id,actor_id,kind) VALUES(new_id,p_actor,'quote_created');
 RETURN (SELECT to_jsonb(q) FROM public.instant_orders q WHERE q.id=new_id);
END;$$;
CREATE FUNCTION public.instant_sworn_provider(p_provider uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE approved boolean:=false;
BEGIN
 IF to_regprocedure('public.translation_cert_credential_approved(uuid)') IS NOT NULL THEN EXECUTE 'select public.translation_cert_credential_approved($1)' INTO approved USING p_provider;
 ELSIF to_regprocedure('public.block2_credential_approved(uuid)') IS NOT NULL THEN EXECUTE 'select public.block2_credential_approved($1)' INTO approved USING p_provider;END IF;
 RETURN coalesce(approved,false);
END;$$;
CREATE FUNCTION public.instant_confirm_originals(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.instant_gate();PERFORM public.instant_detail(p_id);PERFORM public.quote_assert(public.quote_staff(auth.uid()),'STAFF_OWNER_REQUIRED');
 UPDATE public.instant_orders SET originals_presented_at=coalesce(originals_presented_at,clock_timestamp()) WHERE id=p_id AND category='sworn';
 PERFORM public.quote_assert(found,'INVALID_STATE');
 INSERT INTO public.instant_order_events(order_id,actor_id,kind) VALUES(p_id,auth.uid(),'originals_presented_at_office');RETURN public.instant_detail(p_id);
END;$$;
CREATE FUNCTION public.instant_assign(p_id uuid,p_provider uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.instant_gate();PERFORM public.instant_detail(p_id);
 PERFORM public.quote_assert(public.quote_staff(auth.uid()) AND public.quote_verified(p_provider) AND EXISTS(SELECT 1 FROM public.quote_provider_readiness WHERE provider_id=p_provider AND state='enabled'),'PROVIDER_INELIGIBLE');
 PERFORM public.quote_assert((SELECT category<>'sworn' FROM public.instant_orders WHERE id=p_id) OR public.instant_sworn_provider(p_provider),'SWORN_CREDENTIAL_REQUIRED');
 UPDATE public.instant_orders SET provider_id=p_provider WHERE id=p_id AND status IN ('quoted','in_progress_deposit_paid');
 PERFORM public.quote_assert(found,'INVALID_STATE');
 INSERT INTO public.instant_order_events(order_id,actor_id,kind) VALUES(p_id,auth.uid(),'provider_assigned');RETURN public.instant_detail(p_id);
END;$$;
CREATE FUNCTION public.instant_review(p_id uuid,p_words integer,p_pages integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.instant_orders;price jsonb;
BEGIN
 PERFORM public.instant_gate();PERFORM public.instant_detail(p_id);PERFORM public.quote_assert(public.quote_staff(auth.uid()),'STAFF_OWNER_REQUIRED');
 SELECT * INTO q FROM public.instant_orders WHERE id=p_id FOR UPDATE;
 PERFORM public.quote_assert(q.status='manual_review','INVALID_STATE');
 price:=public.instant_price(q.category,p_words,p_pages,q.first_order);
 UPDATE public.instant_orders SET counted_words=p_words,billable_words=(price->>'billable_words')::integer,page_count=p_pages,subtotal_minor=(price->>'subtotal_minor')::bigint,vat_minor=(price->>'vat_minor')::bigint,total_minor=(price->>'total_minor')::bigint,deposit_minor=(price->>'deposit_minor')::bigint,balance_minor=(price->>'balance_minor')::bigint,status='quoted' WHERE id=p_id;
 UPDATE public.instant_orders SET delivery_date=public.instant_delivery_date(p_words,p_pages) WHERE id=p_id;
 INSERT INTO public.instant_order_events(order_id,actor_id,kind) VALUES(p_id,auth.uid(),'manual_review_quoted');RETURN public.instant_detail(p_id);
END;$$;
CREATE FUNCTION public.instant_pay_mock(p_id uuid,p_command uuid,p_phase text,p_consent boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.instant_orders;prior public.instant_mock_payments;amount bigint;
BEGIN
 PERFORM public.instant_gate();PERFORM public.instant_detail(p_id);
 PERFORM public.quote_assert(p_phase IN ('deposit','balance'),'INVALID_PAYMENT_PHASE');
 SELECT * INTO q FROM public.instant_orders WHERE id=p_id FOR UPDATE;
 PERFORM public.quote_assert(q.customer_id=auth.uid(),'CUSTOMER_REQUIRED');
 SELECT * INTO prior FROM public.instant_mock_payments WHERE command_id=p_command;
 IF found THEN PERFORM public.quote_assert(prior.order_id=p_id AND prior.phase=p_phase AND prior.customer_id=auth.uid(),'COMMAND_CONFLICT');RETURN public.instant_detail(p_id);END IF;
 IF EXISTS(SELECT 1 FROM public.instant_mock_payments WHERE order_id=p_id AND phase=p_phase) THEN RETURN public.instant_detail(p_id);END IF;
 IF p_phase='deposit' THEN
  PERFORM public.quote_assert(q.status='quoted' AND p_consent IS TRUE,'CONSENT_AND_QUOTE_REQUIRED');
  PERFORM pg_advisory_xact_lock(hashtextextended(q.customer_id::text,776));
  PERFORM public.quote_assert(NOT q.first_order OR NOT EXISTS(SELECT 1 FROM public.instant_mock_payments WHERE customer_id=q.customer_id AND phase='deposit'),'FIRST_ORDER_DISCOUNT_ALREADY_USED');
  amount:=q.deposit_minor;
  UPDATE public.instant_orders SET status='in_progress_deposit_paid',consent_version='law31-08-v1',consent_text='I request immediate commencement of work. I understand I lose my 7-day right of withdrawal once translation begins (Law 31-08).',consent_at=clock_timestamp() WHERE id=p_id;
 ELSE
  PERFORM public.quote_assert(q.status='awaiting_balance','INVALID_STATE');amount:=q.balance_minor;
  UPDATE public.instant_orders SET status='paid_in_full' WHERE id=p_id;
 END IF;
 INSERT INTO public.instant_mock_payments(command_id,order_id,phase,amount_minor,customer_id) VALUES(p_command,p_id,p_phase,amount,auth.uid());
 INSERT INTO public.instant_order_events(order_id,actor_id,kind) VALUES(p_id,auth.uid(),'mock_'||p_phase||'_paid');RETURN public.instant_detail(p_id);
END;$$;
CREATE FUNCTION public.instant_start(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.instant_orders;
BEGIN
 PERFORM public.instant_gate();PERFORM public.instant_detail(p_id);
 SELECT * INTO q FROM public.instant_orders WHERE id=p_id FOR UPDATE;
 PERFORM public.quote_assert(q.provider_id=auth.uid() AND q.status='in_progress_deposit_paid' AND q.consent_at IS NOT NULL,'PROVIDER_START_REQUIRED');
 PERFORM public.quote_assert(q.category<>'sworn' OR (q.originals_presented_at IS NOT NULL AND public.instant_sworn_provider(auth.uid())),'ORIGINALS_AND_SWORN_CREDENTIAL_REQUIRED');
 IF q.work_started_at IS NULL THEN
  UPDATE public.instant_orders SET work_started_at=clock_timestamp() WHERE id=p_id;
  INSERT INTO public.instant_order_events(order_id,actor_id,kind) VALUES(p_id,auth.uid(),'translation_started');
 END IF;RETURN public.instant_detail(p_id);
END;$$;
CREATE FUNCTION public.instant_record_complete(p_actor uuid,p_id uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.instant_orders;
BEGIN
 PERFORM public.instant_gate();PERFORM public.quote_assert(auth.role()='service_role' AND public.quote_verified(p_actor),'UNAVAILABLE');
 SELECT * INTO q FROM public.instant_orders WHERE id=p_id FOR UPDATE;
 PERFORM public.quote_assert(q.provider_id=p_actor AND q.status='in_progress_deposit_paid' AND q.work_started_at IS NOT NULL,'PROVIDER_COMPLETE_REQUIRED');
 UPDATE public.instant_orders SET final_file=p_payload->'final',draft_file=p_payload->'draft',completed_at=clock_timestamp(),status='awaiting_balance' WHERE id=p_id;
 INSERT INTO public.instant_order_events(order_id,actor_id,kind) VALUES(p_id,p_actor,'translation_complete');
 RETURN (SELECT to_jsonb(o) FROM public.instant_orders o WHERE id=p_id);
END;$$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure fn FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'instant\_%' ESCAPE '\' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.fn); END LOOP;
END;$$;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.instant_detail(uuid),public.instant_list(),public.instant_providers(),public.instant_assign(uuid,uuid),public.instant_review(uuid,integer,integer),public.instant_pay_mock(uuid,uuid,text,boolean),public.instant_start(uuid),public.instant_confirm_originals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.instant_record_order(uuid,jsonb),public.instant_record_complete(uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
