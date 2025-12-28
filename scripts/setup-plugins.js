const fs = require('fs');
const path = require('path');

const pluginsToSetup = [
  {
    name: 'rnww-plugin-camera',
    keepModules: ['customcamera']
  },
  {
    name: 'rnww-plugin-microphone',
    keepModules: ['custommicrophone']
  },
  {
    name: 'rnww-plugin-screen-pinning',
    keepModules: ['screenpinning']
  }
];

console.log('🔧 Setting up Expo plugins for autolinking...');

pluginsToSetup.forEach(plugin => {
  const pluginPath = path.join(__dirname, '..', 'node_modules', plugin.name);
  
  if (!fs.existsSync(pluginPath)) {
    console.log(`⚠️  ${plugin.name} not found, skipping...`);
    return;
  }

  // Copy expo-module.config.json to package root
  const configSource = path.join(pluginPath, 'src', 'modules', 'expo-module.config.json');
  const configDest = path.join(pluginPath, 'expo-module.config.json');
  
  if (fs.existsSync(configSource)) {
    fs.copyFileSync(configSource, configDest);
    console.log(`✅ ${plugin.name}: expo-module.config.json copied`);
  }

  // Copy android folder to package root
  const androidSource = path.join(pluginPath, 'src', 'modules', 'android');
  const androidDest = path.join(pluginPath, 'android');
  
  if (fs.existsSync(androidSource)) {
    // android 폴더가 이미 존재하면 삭제
    if (fs.existsSync(androidDest)) {
      fs.rmSync(androidDest, { recursive: true, force: true });
    }
    fs.cpSync(androidSource, androidDest, { recursive: true });
    
    // 불필요한 모듈 폴더 제거 (잘못 포함된 파일 정리)
    const javaModulesPath = path.join(androidDest, 'src', 'main', 'java', 'expo', 'modules');
    if (fs.existsSync(javaModulesPath)) {
      const folders = fs.readdirSync(javaModulesPath);
      folders.forEach(folder => {
        if (!plugin.keepModules.includes(folder)) {
          const folderPath = path.join(javaModulesPath, folder);
          if (fs.statSync(folderPath).isDirectory()) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`   🧹 Removed invalid folder: ${folder}`);
          }
        }
      });
    }
    
    console.log(`✅ ${plugin.name}: android folder copied`);
  }

  // Copy ios folder to package root
  const iosSource = path.join(pluginPath, 'src', 'modules', 'ios');
  const iosDest = path.join(pluginPath, 'ios');
  
  if (fs.existsSync(iosSource)) {
    // ios 폴더가 이미 존재하면 삭제
    if (fs.existsSync(iosDest)) {
      fs.rmSync(iosDest, { recursive: true, force: true });
    }
    fs.cpSync(iosSource, iosDest, { recursive: true });
    console.log(`✅ ${plugin.name}: ios folder copied`);
  }
});

console.log('✨ Plugin setup complete!');
