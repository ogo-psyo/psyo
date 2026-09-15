"""Eight simultaneous saves, synthetic rows in pso_release_atomic_test only."""
import concurrent.futures,json,subprocess,uuid

def sql(query):
    result=subprocess.run(['docker','exec','-i','supabase_db_pso-mvp','psql','-U','postgres','-d','pso_release_atomic_test','-X','-At','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,check=True)
    return result.stdout.strip()
def literal(value):
    return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
owner,pet,thread,source,acting,route=[str(uuid.uuid4()) for _ in range(6)]
walk={'title':'Concurrent QA','path':[[37.6,55.75],[37.601,55.751]],'stops':[{'point':[37.6,55.75],'title':'Start'},{'point':[37.601,55.751],'title':'End'}],'distanceMeters':150,'estimatedMinutes':2,'stairs':False}
row={'pet_id':pet,'title':walk['title'],'path':'SRID=4326;LINESTRING(37.6 55.75,37.601 55.751)','visibility':'private','moderation_status':'approved','color':'#3b82f6','route_source':'planned','planning':{'version':1,'mode':'walking','stops':walk['stops'],'estimatedMinutes':2},'path_gaps':[],'distance_meters':150}
try:
    sql(f"insert into auth.users(id) values('{owner}');insert into public.profiles(id) values('{owner}');insert into public.pets(id,owner_id,name) values('{pet}','{owner}','Concurrent walk QA');insert into public.assistant_threads(id,pet_id,kind,title) values('{thread}','{pet}','general','QA');insert into public.agent_runs(id,owner_id,pet_id,thread_id,request_id,question,status,result) values('{source}','{owner}','{pet}','{thread}',gen_random_uuid(),'QA','succeeded',{literal({'walk':walk})});insert into public.agent_runs(id,owner_id,pet_id,thread_id,request_id,question,status) values('{acting}','{owner}','{pet}','{thread}',gen_random_uuid(),'Сохрани прогулку','running');")
    command=f"select public.agent_save_walk_atomic('{owner}','{route}',repeat('c',64),{literal(row)},'{source}','{acting}',{literal(walk)});"
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda _:json.loads(sql(command)),range(8)))
    assert len({r['feature']['id'] for r in results})==1
    assert sum(not r['replayed'] for r in results)==1
    assert sql(f"select count(*) from public.map_routes where owner_id='{owner}';")=='1'
    assert sql(f"select count(*) from public.agent_mutations where run_id='{acting}';")=='1'
    print('PASS 8 concurrent calls: one canonical route, one action receipt, seven replays')
finally:
    sql(f"delete from public.pets where id='{pet}';delete from public.profiles where id='{owner}';delete from auth.users where id='{owner}';")
