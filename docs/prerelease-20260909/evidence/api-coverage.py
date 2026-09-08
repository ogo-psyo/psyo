from pathlib import Path
import json
p=Path(__file__).resolve().parent;rows=json.loads((p/'api-inventory.json').read_text())
def classify(s):
 if s=='/api/assistant':return 'AssistantService (existing)','HOME-01–03','owner/pet, bounded context; not PR29 agent'
 if '/internal/' in s:return 'Operations','SYS-07','health/release read-only; job-specific scheduler authorization for retention/outcomes'
 if '/social/' in s:return 'SocialService','GAV-01–10','owner/participant; helper guards'
 if '/map/' in s or '/zones' in s:return 'MapService','MAP-01–10','owner or explicit public/coarse projection'
 if '/observations' in s or s=='/api/health' or '/summary' in s:return 'Health/ObservationService','OBS-01–07','owner/pet'
 if '/stt/' in s:return 'VoiceCaptureService','OBS-02/03','owner + quota/provider'
 if '/reminders' in s:return 'ReminderService','CARE-01–05','owner/pet; callback path separate'
 if '/habits' in s:return 'HabitService','HAB-01–03','owner/pet'
 if '/wishlist' in s:return 'WishlistService','WISH-01–03','owner/pet'
 if '/documents' in s:return 'DocumentService','DOC-01–03','owner + private Storage'
 if '/avatar' in s:return 'AvatarService','PRO-03','owner + capability/provider/public projection explicit'
 if '/dog-cards' in s:return 'PublicCardService','PRO-04/SYS-06','publish owner; anonymous whitelist read'
 if '/recommendation' in s:return 'RecommendationService','HOME-03','owner or scheduler; flag retained'
 if '/billing/' in s:return 'BillingService','SYS-07','flag OFF retained; server entitlements/webhook'
 if '/telegram/webhook' in s:return 'TelegramDelivery','CARE-05/SYS-07','server webhook auth; at-least-once'
 if '/internal/' in s:return 'Operations','SYS-07','read-only health/release; privileged retention scheduler'
 if '/admin/' in s:return 'Administration','SYS-08','privileged, excluded from consumer UI'
 if '/pets' in s or '/onboarding/' in s:return 'ProfileService','PRO-01/02/SYS-02/03/05','owner/pet'
 if '/account' in s:return 'AccountService','SYS-05','owner; deletion scope'
 return 'Identity/Bootstrap','SYS-01/04','session, bearer or explicit anonymous contract'
text='''# API → сервис → экран → проверка

Механический реестр c15d067: 69 route-файлов и 99 HTTP method exports, включая destructured GET/POST Better Auth. Таблица связывает каждый обработчик с семейством UI/операций; **она не доказывает, что все guard/RLS уже корректны**. Для каждого приватного обработчика требуется A-30, для мутаций — failure/retry/race тесты соответствующего домена из раздела 05. Точный payload/DTO сохраняется до отдельного review изменения.

Экспорты auth handler делегируют внутренние действия библиотеке; 99 exports не равно 99 бизнес-операциям. RPC/таблицы/маркеры в CSV извлечены статически, транзитивные helper зависимости допроверяются при реализации.

| Endpoint | Методы | Сервис | UI/состояния | Граница проверки |
|---|---|---|---|---|
'''
for r in rows:
 service,surface,boundary=classify(r['path']);text+=f"| `{r['path']}` | {r['methods']} | {service} | {surface} | {boundary}; требуется staging evidence |\n"
(p.parent/'06-API-COVERAGE.md').write_text(text)
