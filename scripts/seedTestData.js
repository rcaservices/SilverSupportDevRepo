// File: scripts/seedTestData.js
const { Client } = require('pg');
require('dotenv').config();

async function seedTestData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database for seeding test data');

    // Clear existing test data (be careful in production!)
    if (process.env.NODE_ENV === 'development') {
      console.log('Clearing existing test data...');
      await client.query('DELETE FROM monthly_usage WHERE subscriber_id IN (SELECT id FROM subscribers WHERE name LIKE \'Test %\')');
      await client.query('DELETE FROM support_interactions WHERE subscriber_id IN (SELECT id FROM subscribers WHERE name LIKE \'Test %\')');
      await client.query('DELETE FROM voice_auth_attempts WHERE phone_number LIKE \'+1555%\'');
      await client.query('DELETE FROM call_sessions WHERE phone_number LIKE \'+1555%\'');
      await client.query('DELETE FROM pending_signups WHERE senior_name LIKE \'Test %\'');
      await client.query('DELETE FROM subscribers WHERE name LIKE \'Test %\'');
    }

    // Seed test subscribers
    console.log('Creating test subscribers...');
    
    const testSubscribers = [
      {
        name: 'Test Mary Johnson',
        phone_number: '+15551234567',
        email: 'mary.johnson.family@example.com',
        address_street: '123 Maple Street',
        address_city: 'Springfield',
        address_state: 'IL',
        subscription_tier: 'basic',
        voice_enrollment_completed: true,
        enrolled_by: 'Susan Johnson',
        family_contact_email: 'susan.johnson@example.com'
      },
      {
        name: 'Test Robert Wilson',
        phone_number: '+15551234568',
        email: 'bob.family@example.com',
        address_street: '456 Oak Avenue',
        address_city: 'Riverside',
        address_state: 'CA',
        subscription_tier: 'premium',
        voice_enrollment_completed: true,
        enrolled_by: 'Mike Wilson',
        family_contact_email: 'mike.wilson@example.com'
      },
      {
        name: 'Test Dorothy Smith',
        phone_number: '+15551234569',
        email: 'dorothy.family@example.com',
        address_street: '789 Pine Road',
        address_city: 'Lakewood',
        address_state: 'FL',
        subscription_tier: 'family',
        voice_enrollment_completed: false,
        enrolled_by: 'Jennifer Smith',
        family_contact_email: 'jennifer.smith@example.com'
      }
    ];

    for (const subscriber of testSubscribers) {
      const result = await client.query(`
        INSERT INTO subscribers (
          name, phone_number, email, address_street, address_city, address_state,
          subscription_tier, voice_enrollment_completed, enrolled_by, family_contact_email,
          voice_print_hash, monthly_call_limit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        subscriber.name,
        subscriber.phone_number,
        subscriber.email,
        subscriber.address_street,
        subscriber.address_city,
        subscriber.address_state,
        subscriber.subscription_tier,
        subscriber.voice_enrollment_completed,
        subscriber.enrolled_by,
        subscriber.family_contact_email,
        subscriber.voice_enrollment_completed ? 'test_voice_hash_' + Date.now() : null,
        subscriber.subscription_tier === 'basic' ? 50 : 
        subscriber.subscription_tier === 'premium' ? 200 : 500
      ]);
      
      console.log(`Created subscriber: ${subscriber.name} with ID ${result.rows[0].id}`);
    }

    // Seed pending signups
    console.log('Creating test pending signups...');
    
    const pendingSignups = [
      {
        senior_name: 'Test Margaret Brown',
        senior_phone_number: '+15551234570',
        family_member_name: 'David Brown',
        family_email: 'david.brown@example.com',
        relationship: 'son',
        selected_tier: 'basic'
      },
      {
        senior_name: 'Test Frank Miller',
        senior_phone_number: '+15551234571',
        family_member_name: 'Lisa Miller',
        family_email: 'lisa.miller@example.com',
        relationship: 'daughter',
        selected_tier: 'premium'
      }
    ];

    for (const signup of pendingSignups) {
      await client.query(`
        INSERT INTO pending_signups (
          senior_name, senior_phone_number, family_member_name, 
          family_email, relationship, selected_tier, signup_method
        ) VALUES ($1, $2, $3, $4, $5, $6, 'online')
      `, [
        signup.senior_name,
        signup.senior_phone_number,
        signup.family_member_name,
        signup.family_email,
        signup.relationship,
        signup.selected_tier
      ]);
      
      console.log(`Created pending signup for: ${signup.senior_name}`);
    }

    // Seed some test call sessions and usage data
    console.log('Creating test call sessions and usage data...');
    
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    
    // Get subscriber IDs
    const subscribersResult = await client.query(`
      SELECT id, name, phone_number FROM subscribers WHERE name LIKE 'Test %'
    `);
    
    for (const subscriber of subscribersResult.rows) {
      // Create monthly usage record
      await client.query(`
        INSERT INTO monthly_usage (
          subscriber_id, billing_month, total_calls, ai_handled_calls,
          average_satisfaction, resolution_rate, base_subscription_cost_cents
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (subscriber_id, billing_month) DO NOTHING
      `, [
        subscriber.id,
        currentMonth,
        Math.floor(Math.random() * 20) + 5, // 5-25 calls
        Math.floor(Math.random() * 15) + 3, // 3-18 AI handled
        (Math.random() * 2 + 3).toFixed(2), // 3.0-5.0 satisfaction
        (Math.random() * 0.3 + 0.7).toFixed(2), // 70-100% resolution
        2999 // $29.99 in cents
      ]);
      
      console.log(`Created usage data for: ${subscriber.name}`);
    }

    console.log('Test data seeding completed successfully!');
    console.log('\nTest Accounts Created:');
    console.log('- Mary Johnson: +15551234567 (Basic, Voice Enrolled)');
    console.log('- Robert Wilson: +15551234568 (Premium, Voice Enrolled)');
    console.log('- Dorothy Smith: +15551234569 (Family, Needs Voice Enrollment)');
    console.log('\nPending Signups:');
    console.log('- Margaret Brown: +15551234570 (Awaiting Voice Enrollment)');
    console.log('- Frank Miller: +15551234571 (Awaiting Voice Enrollment)');
    console.log('\nYou can test by calling your Twilio number from these phone numbers');

  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  seedTestData();
}

module.exports = seedTestData;