alter table public.recommendations
  drop constraint if exists recommendations_category_check;
alter table public.recommendations
  add constraint recommendations_category_check
  check (category in ('care','wellbeing','habit','walk','thing','social'));

alter table public.recommendation_preferences
  drop constraint if exists recommendation_preferences_category_check;
alter table public.recommendation_preferences
  add constraint recommendation_preferences_category_check
  check (category in ('care','wellbeing','habit','walk','thing','social'));

alter table public.recommendation_evidence
  drop constraint if exists recommendation_evidence_source_type_check;
alter table public.recommendation_evidence
  add constraint recommendation_evidence_source_type_check
  check (source_type in (
    'profile','passport','reminder','observation','habit',
    'map_zone','route','wishlist','explicit_request','social_signal','social_request'
  ));

alter table public.recommendation_outcome_failures
  drop constraint if exists recommendation_outcome_failures_domain_type_check;
alter table public.recommendation_outcome_failures
  add constraint recommendation_outcome_failures_domain_type_check
  check (domain_type in ('reminder','habit','route','wishlist','social_request','social_signal'));
