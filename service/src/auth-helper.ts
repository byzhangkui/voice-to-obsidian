import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';

export async function ensureAuthenticated(clientId: string, clientSecret: string, envPath: string): Promise<string> {
  // If we already have a refresh token in the env, just use it
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    return process.env.GOOGLE_REFRESH_TOKEN;
  }

  console.log('\n==================================================');
  console.log('🔒 未检测到 GOOGLE_REFRESH_TOKEN，正在启动交互式授权...');
  console.log('==================================================\n');

  const PORT = 3000;
  const redirectUri = `http://localhost:${PORT}/oauth2callback`;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const scopes = ['https://www.googleapis.com/auth/drive.file'];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url && req.url.startsWith('/oauth2callback')) {
          const q = url.parse(req.url, true).query;
          
          if (q.error) {
            console.error('授权失败:', q.error);
            res.end('<h1>授权失败，请查看终端输出</h1>');
            server.close();
            reject(new Error(q.error as string));
            return;
          }
          
          if (q.code) {
            const { tokens } = await oauth2Client.getToken(q.code as string);
            
            res.end('<h1>授权成功！你可以关闭这个页面了，服务即将自动启动...</h1>');
            server.close();
            
            if (tokens.refresh_token) {
              console.log('\n✅ 成功获取到 Refresh Token！');
              
              // 自动写入到 .env 文件中
              try {
                let envContent = fs.readFileSync(envPath, 'utf8');
                if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
                  envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
                } else {
                  envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
                }
                fs.writeFileSync(envPath, envContent);
                console.log('✅ 已自动将其保存到 .env 文件中！\n');
                
                // 设置当前环境变量，以便当前进程继续执行
                process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
                resolve(tokens.refresh_token);
              } catch (writeErr) {
                console.warn('⚠️ 获取成功，但写入 .env 文件失败。请手动添加:');
                console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
                process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
                resolve(tokens.refresh_token);
              }
            } else {
              reject(new Error('没有返回 refresh_token。请去 Google 账号取消授权后重试。'));
            }
          }
        }
      } catch (e: any) {
        res.end('<h1>发生错误，请查看终端</h1>');
        server.close();
        reject(e);
      }
    });

    server.listen(PORT, () => {
      console.log('1. 请按住 Cmd (或 Ctrl) 键并点击下方链接，在浏览器中打开：\n');
      console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
      console.log('2. 登录你的 Google 账号并同意授权。');
      console.log(`3. 正在监听 http://localhost:${PORT} 等待回调...\n`);
    });
  });
}
