-- Remove legado de status TRIAL da plataforma.
-- Regra de negocio atual: nao existe periodo trial.

create temporary table if not exists tmp_trial_companies on commit drop as
select c.id
from companies c
where upper(coalesce(c.status, '')) in ('TRIAL', 'TRIALING')
   or upper(coalesce(c.subscription_status, '')) in ('TRIAL', 'TRIALING');

-- Libera referencias opcionais para permitir exclusao dos usuarios.
update atendimento_conversations
set assigned_user_id = null,
    assigned_user_name = null
where assigned_user_id in (
    select u.id
    from users u
    join tmp_trial_companies t on t.id = u.company_id
);

update atendimento_sessions
set responsible_user_id = null,
    responsible_user_name = null
where responsible_user_id in (
    select u.id
    from users u
    join tmp_trial_companies t on t.id = u.company_id
);

-- Remove contas trial legadas.
delete from user_roles
where user_id in (
    select u.id
    from users u
    join tmp_trial_companies t on t.id = u.company_id
);

delete from password_reset_tokens
where user_id in (
    select u.id
    from users u
    join tmp_trial_companies t on t.id = u.company_id
);

delete from users
where company_id in (select id from tmp_trial_companies);

delete from companies
where id in (select id from tmp_trial_companies);

-- Higieniza quaisquer status trial restantes em tabelas de assinatura.
update companies
set status = 'ACTIVE'
where upper(coalesce(status, '')) in ('TRIAL', 'TRIALING');

update companies
set subscription_status = 'ACTIVE'
where upper(coalesce(subscription_status, '')) in ('TRIAL', 'TRIALING');

update ioauto_billing_subscriptions
set status = 'inactive'
where upper(coalesce(status, '')) in ('TRIAL', 'TRIALING');

update onboarding_subscriptions
set status = 'PENDING'
where upper(coalesce(status, '')) in ('TRIAL', 'TRIALING');
