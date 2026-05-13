alter table ioauto_subscription_plans
    add column if not exists monthly_price_cents bigint,
    add column if not exists annual_price_cents bigint;

update ioauto_subscription_plans
set monthly_price_cents = coalesce(
        monthly_price_cents,
        case
            when upper(coalesce(billing_recurrence, '')) = 'MONTHLY' then price_cents
            when annual_price_cents is null then price_cents
            else monthly_price_cents
        end
    ),
    annual_price_cents = coalesce(
        annual_price_cents,
        case
            when upper(coalesce(billing_recurrence, '')) in ('ANNUAL', 'YEARLY', 'YEAR') then price_cents
            else annual_price_cents
        end
    ),
    updated_at = now()
where price_cents is not null
  and (
      monthly_price_cents is null
      or annual_price_cents is null
  );

update ioauto_subscription_plans
set
    billing_recurrence = case
        when monthly_price_cents is not null then 'MONTHLY'
        when annual_price_cents is not null then 'ANNUAL'
        else billing_recurrence
    end,
    price_cents = case
        when monthly_price_cents is not null then monthly_price_cents
        when annual_price_cents is not null then annual_price_cents
        else price_cents
    end,
    updated_at = now();

update ioauto_billing_subscriptions
set billing_interval = case
    when upper(coalesce(billing_interval, '')) in ('YEAR', 'ANNUAL') then 'YEARLY'
    when upper(coalesce(billing_interval, '')) = 'MONTH' then 'MONTHLY'
    when upper(coalesce(billing_interval, '')) = 'WEEK' then 'WEEKLY'
    else upper(coalesce(billing_interval, ''))
end
where coalesce(billing_interval, '') <> '';

update companies
set billing_recurrence = case
    when upper(coalesce(billing_recurrence, '')) in ('YEAR', 'ANNUAL') then 'YEARLY'
    when upper(coalesce(billing_recurrence, '')) = 'MONTH' then 'MONTHLY'
    when upper(coalesce(billing_recurrence, '')) = 'WEEK' then 'WEEKLY'
    else upper(coalesce(billing_recurrence, ''))
end
where coalesce(billing_recurrence, '') <> '';

update ioauto_subscription_plans
set
    is_active = false,
    is_system = false,
    updated_at = now()
where plan_key = 'personalizado'
  and is_custom = true
  and is_system = true;
