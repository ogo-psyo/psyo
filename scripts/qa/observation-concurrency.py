"""Local-only, synthetic fixture. Requires observation migration in a disposable DB."""
import concurrent.futures
import json
import subprocess
import uuid

CONTAINER = 'supabase_db_pso-mvp'
DATABASE = 'pso_release_atomic_test'

def sql(statement):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-U', 'postgres', '-d', DATABASE, '-At', '-v', 'ON_ERROR_STOP=1'], input=statement, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

owner, pet = str(uuid.uuid4()), str(uuid.uuid4())
try:
    sql(f"INSERT INTO auth.users(id) VALUES ('{owner}'); INSERT INTO public.pets(id,owner_id,name) VALUES ('{pet}','{owner}','Concurrency fixture');")
    call = f"SELECT public.care_observation_atomic('{owner}','concurrent-create','{'a'*64}','create','{pet}', '{{\"type\":\"note\",\"value\":\"Concurrent fixture\"}}');"
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(lambda _: json.loads(sql(call)), range(8)))
    assert all(item == results[0] for item in results), 'replay receipts diverged'
    assert sql(f"SELECT count(*) FROM public.pet_observations WHERE pet_id='{pet}';") == '1', 'duplicate observation'
    observation = results[0]['observation']['id']
    def update(i):
        patch = json.dumps({'metadata': {f'field{i}': str(i)}})
        return sql(f"SELECT public.care_observation_atomic('{owner}','concurrent-update-{i}','{'b'*64}','update','{observation}','{patch}');")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(update, range(8)))
    actual = json.loads(sql(f"SELECT metadata FROM public.pet_observations WHERE id='{observation}';"))
    assert actual == {f'field{i}': str(i) for i in range(8)}, 'concurrent metadata patch lost another field'
    def save_profile(i):
        command = f"SELECT public.update_pet_profile_atomic('{owner}','{pet}',0,'device-profile-{i}','{'c'*64}', '{{\"name\":\"Device {i}\"}}', '{{}}', '{{}}');"
        try:
            return json.loads(sql(command))
        except RuntimeError as error:
            if 'PROFILE_VERSION_CONFLICT' not in str(error):
                raise
            return 'conflict'
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        versions = list(executor.map(save_profile, range(2)))
    assert sum(item == 'conflict' for item in versions) == 1, 'two stale-device saves both succeeded'
    print('PASS: two devices saving version 0 -> one commit, one conflict')
    print('PASS: 8 simultaneous retries -> one observation, identical receipts; 8 independent concurrent patches -> all fields retained')
finally:
    sql(f"DELETE FROM auth.users WHERE id='{owner}';")
