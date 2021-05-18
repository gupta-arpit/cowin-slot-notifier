var  nodemailer     = require("nodemailer")
   , axios          = require("axios")
   , moment         = require("moment")
   , cron = require('node-cron')

const testing = false;

require('dotenv').config()


let notify = async(person , slotDetails)=>{
    try{
        console.log("mailer")
        //console.log(slotDetails)
        let rows = ``
        for (i=0;i<slotDetails.length;i++){
             let row = `<tr>
                      <td>`+slotDetails[i].center.name+`</td>
                      <td>`+slotDetails[i].center.district_name+`</td>
                      <td>`+slotDetails[i].center.pincode+`</td>
                      <td>`+slotDetails[i].available_capacity+`</td>
                      <td>`+slotDetails[i].vaccine+`</td>
                      <td>`+slotDetails[i].center.fee_type+`</td>
                    </tr>
                     `
             rows = rows + row       
        }
        let html = `
          <html>
            <head>
                <title>Test-email</title>
                <style>
                    #tests {
                        font-family: Verdana, Helvetica, sans-serif;
                        border-collapse: collapse;
                        width: 100%;
                    }


                    #tests td, #tests th {
                        border: 1px solid #ddd;
                        padding: 8px;
                    }

                    #tests tr:nth-child(even){background-color: #f2f2f2;}

                    #tests tr:hover {background-color: #ddd;}

                    #tests th {
                        padding-top: 12px;
                        padding-bottom: 12px;
                        text-align: left;
                        background-color: #023b52;
                        color: white;
                    }

                    .additionalStyles{
                        font-family: Verdana, Helvetica, sans-serif;
                    }
                </style>
            </head>
            <body>

        
            <h3 class="additionalStyles"> Available Slots </h3>


            <table id="tests">
                <tr>
                    <th>Center-Name</th>
                    <th>District</th>
                    <th>Pincode</th>
                    <th>Slots available</th>
                    <th>Vaccine</th>
                    <th>Fee</th>
                </tr>
                 `+rows+`
            </table>
            
            </body>
            </html>

        `

        const buff = Buffer.from(html, "utf-8");

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL, 
              pass: process.env.PASS 
            },
          });

        let totalSlotsAvailable = slotDetails.reduce((mem, s) => mem + s.available_capacity, 0);
        let emails = testing ? person.testEmail.split(",") : person.email.split(",");
        for (let i = 0; i < emails.length; i++) {
            let email = emails[i];
                      // send mail with defined transport object
            let info = await transporter.sendMail({
                from: process.env.EMAIL, // sender address
                to: email, // list of receivers
                subject:`${totalSlotsAvailable} vaccine slots available`, // Subject line
                text: 'For clients with plaintext support only',
                html: buff,
            });
            console.log(info);
        }
    } catch(error) {
       console.log(error)
       throw error   
    }
 
}


let checkSlots = async(person,date)=>{
   try{
    
    for(i = 0 ; i < person.pincodes.length ; i++ ) {
       let config = {
          method: 'get',
          url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode='+person.pincodes[i]+'&date='+date,
          headers: {
              'accept': 'application/json',
              'Accept-Language': 'hi_IN',
              'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.72 Safari/537.36'
          }
        }

       response = await axios(config)
       let centers = response.data.centers;
       let sessions = centers.reduce((mem, c) => [...mem, ...c.sessions.map(s => ({...s, center: c}))], []);
       let validSlots = testing ? sessions : sessions.filter(slot => slot.min_age_limit <= person.age &&  slot.available_capacity > 0)
    //    console.log(validSlots)
       console.log({date:date, validSlots: validSlots.length})
       if(validSlots.length > 0 || testing) {
            await notify(person, validSlots);
       }       
     }  
   }catch(error){
       console.log(error)
       throw error
   }
}


let fetchNext5Days = async()=>{
    let dates = [];
    let today = moment();
    for(let i = 0 ; i < 5 ; i ++ ){
        let dateString = today.format('DD-MM-YYYY')
        dates.push(dateString);
        today.add(1, 'day');
    }
    return dates;
}

let checkAvailability = async(person)=>{
    let datesArray = await fetchNext5Days();
    datesArray.forEach(async(date) => {
        await checkSlots(person,date)
    })
}




let main = async()=>{
    try {

        let person = {
          pincodes : [473660],
          email : process.env.PERSON, // email of the person
          age : 18, //minimum tracking age
          testEmail : process.env.TEST_PERSON,
        }
        if (testing) {
            // test immediately
            checkAvailability(person)
        }
       cron.schedule('*/1 * * * *', async () => {
             checkAvailability(person)
       });
    } catch (error) {
        console.log('an error occured: ' + JSON.stringify(e, null, 2));
        throw error
    }
}

main()
