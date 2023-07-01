import express from 'express';
import dotenv from 'dotenv';
import jsforce from 'jsforce';
import axios from 'axios';

import SOBJECT  from './Utils/SFConsts.js';

dotenv.config();
const { 
  PORT, 
  SF_LOGIN_URL, SF_USERNAME, SF_PASSWORD, SF_TOKEN, 
  API_NUTRITION_APP_ID, API_NUTRITION_APP_KEY
} = process.env;

const app = express();

const conn = new jsforce.Connection({
  loginUrl: SF_LOGIN_URL
});

conn.login(SF_USERNAME, `${SF_PASSWORD}${SF_TOKEN}`)
  .then((userInfo) => console.log('connected at Org', userInfo.organizationId))
  .catch((err) => console.log('login error'));


app.get('/', async (req, res) => {  
  res.send('Hello World!');
});

app.get('/food/:name', async (req, res) => {
  const { name } = req.params;
  const resultSF = await conn.query(`
  SELECT 
    Id, Name, Serving__c, Calories__c, DietLabels__c, HealthLabels__c, foodId__c, Carbohydrate__c, Protein__c, Fat__c, Fiber__c
  FROM ${SOBJECT.FOOD}
  WHERE
    Name = '${name}'
  `);

  if(resultSF.totalSize) {
    return res.send(resultSF.records[0]);
  }
  
  const result = await axios.get(`https://api.edamam.com/api/nutrition-data?app_id=${API_NUTRITION_APP_ID}&app_key=${API_NUTRITION_APP_KEY}&nutrition-type=logging&ingr=${name}`);
  if(result.status != 200) {
    return res.send({ error: 'API_OFFLINE' });
  }

  const { data } = result;

  if(data.totalWeight === 0) {
    return res.status(404).send('Not found');
  }
  
  const payload = {
    Name: name,
    Serving__c: data.totalWeight,
    Calories__c: data.calories,
    DietLabels__c: data.dietLabels.join(';'),
    HealthLabels__c: data.healthLabels.join(';'),
    foodId__c: data.ingredients[0].parsed[0].foodId,
    Carbohydrate__c: data.totalNutrients.CHOCDF.quantity,
    Protein__c: data.totalNutrients.PROCNT.quantity,
    Fat__c: data.totalNutrients.FAT.quantity,
    Fiber__c: data.totalNutrients.FIBTG.quantity
  };

  res.send(payload);

  conn.create(SOBJECT.FOOD, payload);

});


app.listen(PORT, () => {
  console.log('server running');
})