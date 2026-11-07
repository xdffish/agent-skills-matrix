import { SkillsCliService } from '../services/skillsCliService';

async function runSelfTest() {
  console.log('🚀 Running Dual-Perspective Agent Skills Matrix CLI & Service Self-Test...\n');

  const service = new SkillsCliService();

  // 1. Test Agent Detection
  console.log('--- 1. Testing Local Agent Detection ---');
  const agents = service.detectAgents();
  console.log(`Detected catalog of ${agents.length} agent specifications:`);
  for (const agent of agents) {
    const status = agent.isDetected ? '✅ DETECTED' : '⚪ Not configured';
    console.log(`  - [${agent.name.padEnd(16)}] (${agent.id.padEnd(14)}) => ${status} at ${agent.fullSkillsDir}`);
  }

  // 2. Test Ground-Truth Dual-Perspective Matrix
  console.log('\n--- 2. Testing Ground-Truth Dual-Perspective Data Retrieval ---');
  try {
    const matrixData = await service.getMatrixData();
    console.log(`✅ Successfully fetched ground-truth matrix data!`);
    console.log(`   - Central Public Skills (~/.agents/skills): ${matrixData.totalPublicSkills}`);
    console.log(`   - Detected active agents: ${matrixData.detectedAgentsCount}`);

    console.log('\nGround-Truth Inventory per Agent:');
    for (const [id, detail] of Object.entries(matrixData.agentDetails)) {
      if (!detail.agent.isDetected) continue;
      console.log(`\n🤖 [${detail.agent.name}] (Total Active: ${detail.totalActiveCount})`);
      console.log(`   - Linked from Central Pool: ${detail.linkedCount}`);
      console.log(`   - Private Local Skills:     ${detail.privateCount} (Unique/Duplicates/Broken)`);
      console.log(`   - Broken Symlinks:          ${detail.brokenCount}`);
      console.log(`   - Built-in / Plugins:       ${detail.builtinCount}`);

      if (detail.privateSkills.length > 0) {
        console.log(`     Sample Private: ${detail.privateSkills.slice(0, 3).map(s => `${s.name} (${s.kind})`).join(', ')}`);
      }
    }

    console.log('\nSample Public Skills in Central Pool:');
    matrixData.publicSkills.slice(0, 5).forEach((skill, idx) => {
      const mounted = Object.entries(skill.agentStates).filter(([_, st]) => st === 'linked').map(([id]) => id);
      console.log(`   ${idx + 1}. [${skill.name}]`);
      console.log(`      Ground-truth linked agents (${mounted.length}): ${mounted.join(', ') || 'None'}`);
      if (skill.hasYamlError) {
        console.log(`      ⚠️ YAML Syntax Warning: ${skill.yamlErrorMsg}`);
      }
    });

    console.log('\n🎉 Dual-Perspective Self-test completed with ZERO errors!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Self-test failed:', err);
    process.exit(1);
  }
}

runSelfTest();
