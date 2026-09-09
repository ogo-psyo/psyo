"""Local synthetic DB only; no HTTP/provider or user records. Eight concurrent confirms."""
import concurrent.futures, json, subprocess, uuid

def sql(query):
    run=subprocess.run(['docker','exec','-i','supabase_db_pso-mvp','psql','-U','postgres','-d','pso_release_atomic_test','-X','-A','-t','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,check=True)
    return run.stdout.strip()
owner,pet,request=[str(uuid.uuid4()) for _ in range(3)]
try:
    sql(f"insert into auth.users(id) values('{owner}');insert into public.profiles(id) values('{owner}');insert into public.pets(id,owner_id,name) values('{pet}','{owner}','Concurrent draft QA');")
    run=json.loads(sql(f"select public.agent_admit_run('{owner}','{pet}',null,'{request}','Обычная заметка');"))['id']
    sql(f"update public.agent_runs set status='running' where id='{run}';")
    draft=json.loads(sql(f"select public.agent_prepare_observation('{owner}','{run}','{{}}');"))['id']
    sql(f"update public.agent_runs set status='succeeded' where id='{run}';")
    command=f"select public.agent_confirm_observation('{owner}','{draft}','{{\"note\":\"Same reviewed note\",\"observedAt\":\"2026-09-09T07:00:00Z\",\"metrics\":{{}}}}');"
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        rows=list(pool.map(lambda _:json.loads(sql(command)),range(8)))
    assert len({row['observation']['id'] for row in rows})==1
    assert sql(f"select count(*) from public.pet_observations where pet_id='{pet}';")=='1'
    print('PASS: 8 concurrent confirmations -> 1 observation, identical saved ID')
finally:
    sql(f"delete from public.pets where id='{pet}';delete from public.profiles where id='{owner}';delete from auth.users where id='{owner}';")
