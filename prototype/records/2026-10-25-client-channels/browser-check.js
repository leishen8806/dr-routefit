async (page) => {
  const context = await page.context().browser().newContext({ reducedMotion: 'reduce' });
  const tab = await context.newPage();
  const errors = [], externalRequests = [], checks = [];
  const base = 'http://127.0.0.1:4173/prototype/';
  const output = 'E:/Dr.RouteFit/prototype/records/2026-10-25-client-channels/';
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  tab.on('pageerror', error => errors.push(error.message));
  tab.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) externalRequests.push(request.url()); });
  try {
    for (const width of [360, 390, 1440]) {
      await tab.setViewportSize({ width, height: 900 });
      for (const kind of ['web', 'customer', 'driver']) {
        await tab.goto(base + 'entry.html?kind=' + kind);
        assert(await tab.locator('[type=submit]').innerText() === (kind === 'web' ? '进入工作台演示' : '进入演示'), 'Honest entry label');
        assert(await tab.locator('[data-kind=customer]').innerText() === 'Telegram 用户端', 'Customer label');
        assert((await tab.locator('[data-kind=driver]').innerText()).includes('iOS／Android'), 'Driver platforms');
        assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow: ' + kind + width);
        assert(await tab.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), 'Logo missing');
        if (width === 390 && kind !== 'web') await tab.screenshot({ path: output + kind + '-entry.png', fullPage: true });
      }
    }
    checks.push('360 / 390 / 1440 三种入口名称、Logo 与无横向溢出');
    for (const kind of ['customer', 'driver']) {
      await tab.setViewportSize({ width: 390, height: 844 });
      await tab.goto(base + 'entry.html?kind=' + kind);
      await tab.locator('[type=submit]').focus();
      await tab.keyboard.press('Enter');
      assert((await tab.locator('.entry-error').innerText()).includes('DEMO'), 'Demo credential boundary');
      await tab.locator('[name=code]').fill('DEMO');
      await tab.locator('summary').click();
      await tab.locator('[name=scenario]').selectOption('network');
      await tab.locator('[type=submit]').click();
      await tab.waitForFunction(() => document.querySelector('.entry-error')?.textContent.includes('网络连接失败'));
      assert(await tab.locator('[name=code]').inputValue() === 'DEMO', 'Retry lost input');
      await tab.locator('[name=scenario]').selectOption('normal');
      await tab.locator('[type=submit]').click();
      await tab.locator('.message-dialog').waitFor();
      await tab.keyboard.press('Escape');
      await tab.locator('.message-dialog').waitFor({ state: 'detached' });
      assert(await tab.locator('.' + kind + '-app').count() === 1, 'Wrong destination');
    }
    checks.push('客户／司机 DEMO 校验、键盘提交、失败保留输入、重试、减少动态效果、进入原工作区');
    assert(errors.length === 0, errors.join('\n'));
    assert(externalRequests.length === 0, 'Unexpected external request');
    return { status: 'PASS', checks, pageErrors: errors, externalRequests, scope: '网页入口文案与原演示流程，非 Telegram 或 App 真机验收' };
  } finally { await context.close(); }
}
