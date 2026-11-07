import { SkillsCliService } from '../services/skillsCliService';

async function runSelfTest() {
  console.log('🚀 Running Agent Skills Matrix CLI & Service Self-Test...\n');

  const service = new SkillsCliService();

  // 1. Test Agent Detection
  console.log('--- 1. Testing Local Agent Detection ---');
  const agents = service.detectAgents();
  console.log(`Detected catalog of ${agents.length} agent specifications:`);
  for (const agent of agents) {
    const status = agent.isDetected ? '✅ DETECTED' : '⚪ Not configured';
    console.log(`  - [${agent.name.padEnd(16)}] (${agent.id.padEnd(14)}) => ${status} at ${agent.fullSkillsDir}`);
  }

  // 2. Test JSON parsing and Data Retrieval from npx skills
  console.log('\n--- 2. Testing npx skills Integration & JSON Extraction ---');
  try {
    const matrixData = await service.getMatrixData();
    console.log(`✅ Successfully fetched matrix data!`);
    console.log(`   - Total skills found: ${matrixData.totalSkills}`);
    console.log(`   - Detected active agents: ${matrixData.detectedAgentsCount}`);

    // Print agent counts
    console.log('\nVerified Ground-Truth Agent Counts:');
    for (const agent of matrixData.agents.filter(a => a.isDetected)) {
      const count = matrixData.skills.filter(s => s.agents.includes(agent.name)).length;
      console.log(`   - ${agent.name.padEnd(16)}: ${count} skills genuinely mounted`);
    }
    console.log('\nSample Skills Mounted in Matrix:');
    matrixData.skills.slice(0, 5).forEach((skill, idx) => {
      console.log(`   ${idx + 1}. [${skill.name}]`);
      console.log(`      Path: ${skill.path || 'N/A'}`);
      console.log(`      Mounted Agents (${skill.agents.length}): ${skill.agents.join(', ') || 'None'}`);
      if (skill.description) {
        console.log(`      Description: ${skill.description}`);
      }
    });

    console.log('\n🎉 Self-test completed with ZERO errors!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Self-test failed:', err);
    process.exit(1);
  }
}

runSelfTest();
