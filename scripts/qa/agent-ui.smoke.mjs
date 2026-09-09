import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:3291";
const pet = {
  id: "eeeeeeee-0000-4000-8000-000000000003",
  owner_id: "qa-owner",
  name: "Мята",
};
const profile = {
  dogName: pet.name,
  backendPetId: pet.id,
  breedId: "mixed",
  breedGroupId: "mixed",
  lifeStage: "взрослая",
  size: "средняя",
  photos: [],
  selectedStyle: "city",
};
const results = [];
await fs.mkdir("artifacts/agent-ui", { recursive: true });
for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
  const browser = await browserType.launch();
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
      });
      await context.addInitScript(() => {
        window.Telegram = {
          WebApp: {
            initData: "agent-ui-fixture",
            ready() {},
            expand() {},
            enableClosingConfirmation() {},
          },
        };
      });
      const page = await context.newPage();
      let run = null;
      let saves = 0;
      let saveAttempts = 0;
      let memory = [];
      let memoryReads=0,memoryWrites=0;
      const json = (route, body, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      await page.route("https://telegram.org/js/**", (r) =>
        r.fulfill({ status: 200, body: "" }),
      );
      await page.route("**/api/**", (r) => json(r, {}));
      await page.route("**/api/v1/session/telegram", (r) =>
        json(r, {
          mode: "telegram",
          session: { psyoUserId: "qa-owner", ownerId: "qa-owner" },
        }),
      );
      await page.route("**/api/app/bootstrap**", (r) =>
        json(r, {
          mode: "owner",
          connected: true,
          pet,
          pets: [pet],
          profile,
          activePetId: pet.id,
          reminders: [],
          wishlist: [],
          zones: [],
          routes: [],
          observations: [],
          documents: [],
        }),
      );
      await page.route("**/api/agent/runs?*", (r) =>
        json(r, {
          enabled: true,
          latest: run ? { id: run.runId, status: run.status } : null,
        }),
      );
      await page.route("**/api/assistant", (r) => {
        const body = r.request().postDataJSON();
        assert.ok(body.requestId);
        run = {
          runId: crypto.randomUUID(),
          threadId: "eeeeeeee-0000-4000-8000-000000000005",
          question: body.question,
          status: "running",
        };
        return json(r, run, 202);
      });
      await page.route("**/api/agent/runs/*", (r) => {
        if (r.request().method() === "DELETE") {
          run.status = "cancelled";
          return json(r, { ok: true });
        }
        return json(r, run);
      });
      await page.route("**/api/agent/results**", (r) => {
        if (r.request().method() === "POST") {
          saveAttempts++;
          if (saveAttempts === 1)
            return json(r, { error: "fixture_failure" }, 503);
          saves = 1;
          return json(r, { saved: { id: "saved-one" } });
        }
        return json(r, {
          results: saves
            ? [
                {
                  id: "saved-one",
                  title: "Поездка с Мятой",
                  content: "План с проверенными источниками.",
                },
              ]
            : [],
        });
      });
      await page.route("**/api/agent/memory**", (r) => {
        const method = r.request().method();
        if (method === "POST") {
          const body = r.request().postDataJSON();
          memoryWrites++;
          if(memoryWrites===1)return json(r,{error:'fixture_failure'},503);
          const item = {
            id: "memory-one",
            memory_key: body.key,
            content: body.content,
          };
          memory = [item];
          return json(r, { memory: item });
        }
        if (method === "DELETE") {
          memory = [];
          return json(r, { forgotten: true });
        }
        memoryReads++;
        if(memoryReads===1)return json(r,{error:'fixture_failure'},503);
        return json(r, { memories: memory });
      });
      await page.goto(base);
      await page.evaluate((p) => {
        localStorage.setItem("pso.topapp.onboarding.v1", "done");
        localStorage.setItem("pso.product.profile.v5", JSON.stringify(p));
      }, profile);
      await page.reload();
      await page.screenshot({
        path: `artifacts/agent-ui/start-${engine}-${width}.png`,
      });
      const open = async () => {
        await page.locator('.app-tabs button[data-route="profile"]').click();
        await page.locator(".journal-masthead").getByRole("button",{name:"Спросить Псё",exact:true}).click();
        await page.getByRole("dialog", { name: "Спросить Псё" }).waitFor();
      };
      await open();
      const dialog = page.getByRole("dialog", { name: "Спросить Псё" });
      await dialog
        .getByLabel("Вопрос ассистенту")
        .fill("Помоги подготовить поездку");
      await dialog.getByLabel("Вопрос ассистенту").press("Enter");
      await dialog
        .getByRole("button", { name: "Остановить", exact: true })
        .waitFor();
      await dialog
        .getByRole("button", { name: "Закрыть", exact: true })
        .click();
      run.status = "succeeded";
      run.result = {
        answer: "План с проверенными источниками.",
        runId: run.runId,
        threadId: run.threadId,
        sources: [
          {
            url: "https://www.gov.uk/bring-pet-to-great-britain",
            title: "Правила GOV.UK",
          },
        ],
      };
      await page.reload();
      await open();
      await dialog
        .getByText("План с проверенными источниками.", { exact: true })
        .waitFor();
      await dialog
        .getByRole("button", { name: "Сохранить ответ", exact: true })
        .click();
      await dialog
        .getByText("Не удалось сохранить изменение.", { exact: false })
        .waitFor();
      await dialog
        .getByRole("button", { name: "Сохранить ответ", exact: true })
        .click();
      await dialog.getByText("Результат сохранён.", { exact: true }).waitFor();
      assert.equal(saves, 1);
      await dialog.getByRole('button',{name:'Сохранённые ответы',exact:true}).click();
      const savedDialog=page.getByRole('dialog',{name:'Сохранённые ответы',exact:true});
      await savedDialog.getByText('Поездка с Мятой',{exact:true}).click();
      await savedDialog.getByText('План с проверенными источниками.',{exact:true}).waitFor();
      await page.screenshot({path:`artifacts/agent-ui/saved-${engine}-${width}.png`});
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.activeElement?.textContent==='Сохранённые ответы');
      await dialog.getByRole('button',{name:'Что Псё помнит',exact:true}).click();
      const memoryDialog=page.getByRole('dialog',{name:'Что Псё помнит',exact:true});
      await memoryDialog.getByRole('alert').waitFor();
      assert.equal(await memoryDialog.getByText('Пока нет сохранённых сведений.').count(),0);
      await memoryDialog.getByRole('button',{name:'Повторить загрузку'}).click();
      await memoryDialog.getByRole('button',{name:'Добавить сведение'}).click();
      await memoryDialog.getByLabel('О чём запомнить').fill('Прогулки');
      await memoryDialog.getByLabel('Что важно').fill('Не любит велосипеды');
      await memoryDialog.getByRole('button',{name:'Запомнить',exact:true}).click();
      await memoryDialog.getByText('Не удалось сохранить изменение.',{exact:false}).waitFor();
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.activeElement?.textContent==='Что Псё помнит');
      await dialog.getByRole('button',{name:'Что Псё помнит',exact:true}).click();
      assert.equal(await memoryDialog.getByLabel('Что важно').inputValue(),'Не любит велосипеды');
      await memoryDialog.getByRole('button',{name:'Запомнить',exact:true}).click();
      await memoryDialog.getByText('Память обновлена.',{exact:true}).waitFor();
      await memoryDialog.getByRole('button',{name:'Изменить',exact:true}).click();
      assert.equal(await memoryDialog.getByLabel('О чём запомнить').getAttribute('readonly'),'');
      await memoryDialog.getByLabel('Что важно').fill('Держимся подальше от велосипедов');
      await memoryDialog.getByRole('button',{name:'Запомнить',exact:true}).click();
      await memoryDialog.getByText('Память обновлена.',{exact:true}).waitFor();
      assert.equal(memory[0].content,'Держимся подальше от велосипедов');
      await page.screenshot({path:`artifacts/agent-ui/memory-${engine}-${width}.png`});
      await memoryDialog.getByRole('button',{name:'Забыть',exact:true}).click();
      await memoryDialog.getByText('Убрано из памяти.',{exact:false}).waitFor();
      assert.equal(memory.length,0);
      await page.keyboard.press('Escape');
      await dialog
        .getByLabel("Вопрос ассистенту")
        .fill("Помоги выбрать шлейку");
      await dialog.getByLabel("Вопрос ассистенту").press("Enter");
      await dialog
        .getByRole("button", { name: "Остановить", exact: true })
        .click();
      await dialog
        .getByText("Запрошена остановка задания.", { exact: true })
        .waitFor();
      assert.equal(run.status, "cancelled");
      const overflow = await dialog.evaluate(
        (el) => el.scrollWidth > el.clientWidth + 1,
      );
      assert.equal(overflow, false);
      await page.screenshot({
        path: `artifacts/agent-ui/${engine}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      results.push({ engine, width, passed: true, scope: "mock API/UI only" });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
await fs.writeFile(
  "artifacts/agent-ui/result.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
