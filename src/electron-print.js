// Modules to control application life and create native browser window
const path = require("path");
const {PosPrinter} = require("electron-pos-printer");
const {IpcMain} = require('electron');


/**
 * @param {IpcMain} ipcMain
 **/
function handlePrint(ipcMain, defaultPrinter) {
    ipcMain.handle('print-pos-general',  (event, ...args) => {
        const {receipt, res, receiptNumber, date, fiscalSign, terminalId} = args[0].order;
        let totalVat = 0;
        receipt.params.items.forEach(i => {
            totalVat += i.vat;
        });
        const data =  generatePosGeneralBill(res, receipt, String(receiptNumber), date, totalVat, fiscalSign, terminalId);
        letsPrint(data, defaultPrinter);
    });
    
    ipcMain.handle('print-complement',  (event, ...args) => {
        const {order} = args[0];
        printComplementOrBreak(order, defaultPrinter);
    });

    ipcMain.handle('print-break',  (event, ...args) => {
        const {order} = args[0];
        printComplementOrBreak(order, defaultPrinter);
    });
    ipcMain.handle('print-general',  (event, ...args) => {
        var letter = null;
        var keys = null;
        var orderItems = [];
        var refactoredOrderItems = [];
        var allSouces = [];
        var bonusSauce = [];
        var orderSauces =[];
        const {order} = args[0];
        orderItems = [...order.orderItems];
        orderItems.sort((a, b) => {
        return a.product.posCategory?.index - b.product.posCategory?.index;
        });
        letter = orderItems.reduce((acc, cur) => {
        acc[cur.product.posCategory?.prefix] = acc[cur.product.posCategory?.prefix] ?
            [...acc[cur.product.posCategory?.prefix], cur] : [cur];

        return acc;
        }, {});
        keys = Object.keys(letter);

        const sauces = order.orderItems.reduce((acc, cur) => {
            if ( cur.product.pos_category_id === 13 ){
                acc.push({product: cur.product.name, quantity: cur.quantity});
            }
            const filtered = cur.product.billOfMaterials?.filter(item => item.material.pos_category_id && item.material.pos_category_id === 13)
                .map((item) => ({product: item.material.name, quantity: (item.quantity) * cur.quantity}) );
            if (filtered.length > 0){
                filtered.forEach(item => bonusSauce.push(item));
            }

            return acc.concat(filtered);
        }, []);

        const testGroup = bonusSauce.reduce((acc, cur) => {
            acc[cur.product] = {
                quantity: (cur.product in acc ? acc[cur.product].quantity : 0) + cur.quantity
            };

            return acc;
        }, {});

        bonusSauce = Object.keys(testGroup).map(key => {
        const product = key;
        const quantity = testGroup[key].quantity;
        return {
            product, quantity
        };
        });

        const _orderSauces = order.orderItems.filter(item => item.product.pos_category_id === 13);
        orderSauces = _orderSauces;

        const groupedSouces = sauces.reduce((acc, cur) => {
            acc[cur.product] = {
                quantity: (cur.product in acc ? acc[cur.product].quantity : 0) + cur.quantity
            };

            return acc;
        }, {});

        allSouces = Object.keys(groupedSouces).map(key => {
            const product = key;
            const quantity = groupedSouces[key].quantity;
            return {
                product, quantity
            };
        });
        const data = generateProductionGeneralBill(order, keys, letter, orderSauces, bonusSauce);
        letsPrint(data, defaultPrinter);
    });
    
    ipcMain.handle('print-delivery',  (event, ...args) => {
        const {order} = args[0];
        const data = generateProductionDeliveryBill(order);
        letsPrint(data, defaultPrinter);
    });
    
    ipcMain.handle('z-report', (event, ...args) => {
        console.log(args[0].order);
        const { zInfo } = args[0].order;
        const data = generateZReportBill(zInfo);
        letsPrint(data, defaultPrinter);
    });
}

// print action to printer
 function letsPrint(data, defaultPrinter) {
    const options = {
        preview: false, // Preview in window or print
        width: '80mm', //  width of content body
        copies: 1, // Number of copies to print
        printerName: defaultPrinter, // printerName: string, check it at webContent.getPrinters()
        timeOutPerLine: 400,
        margins: {
            marginType: 'none'
        },
        pageSize: { height: 301000, width: 80000 }, // page size
        silent: true,

        };
        PosPrinter.print(data, options).then(result => {
            console.log(result);
        }).catch(error => {
            console.log('error: ' + error);
        });
        
}
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


//#region print-pos-general
{    
 function generatePosGeneralBill(res, receipt, receiptNumber, date, totalVat, fiscalSign, terminalId) {
    const data = [
        // {
        //     type: 'image',
        //     path: path.join(__dirname, 'assets/img/cheque/LOGO.svg'),
        //     position: 'center',                               
        //     width: '250px',                                        
        //     height: '80px',                                      
        //   },
    ];
    data.push(... generateHeader(receipt, res, date, receiptNumber));
    data.push(... generateOrderItems(receipt));
    data.push(... generateTotal(receipt, totalVat));
    data.push(... generateFooter(res, terminalId, receiptNumber, fiscalSign));
    data.push(... generateQrCode(res));
    return data;
}

 function generateHeader(receipt, res, date, receiptNumber) {
    return  [
          {
              type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
              value: `${receipt.companyName}`,
              style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', fontSize: "24px"}
          },
          {
              type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
              value: `${receipt.companyAddress}`,
              style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center"}
          },
          {
              type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
              value: `<span>ИНН №:</span> <span>${receipt.companyINN}</span>`,
              style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between', borderTop: '1px dotted black', marginTop: '2px'}
          },
          {
              type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
              value: `<span>Чек №:</span> <span>${res? res.receiptSeq : receiptNumber.slice(0, 6)}</span>`,
              style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
          },
          {
              type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
              value: `<span>Сана:</span> <span>${date}</span>`,
              style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed black'}
          },
    ]
}

 function generateOrderItems(receipt) {
    let orderItems = [];
    const pipes = new Pipes();
     receipt.params.items.forEach( item => {
        const orderItem = [
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `${item.name}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", fontWeight:'700', textAlign: "left", display: 'flex', justifyContent: 'space-between', marginTop: '5px'}
            },        
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `${pipes.TaxPricePipe(item.price/(item.amount/1000)) +' x ' + pipes.TaxAmountPipe(item.amount) + ' =' + pipes.TaxPricePipe(item.price)}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "left", display: 'flex', justifyContent: 'space-between'}
            },       
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `ҚҚС киймати ${item.vatPercent}% ${pipes.TaxPricePipe(item.vat)}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "left", display: 'flex', justifyContent: 'space-between'}
            },       
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `МХИК коди: ${item.classCode}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "left", display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed black'}
            },
        ];
        orderItems.push(...orderItem);
    });
    return orderItems;
}

 function generateTotal(receipt, totalVat) {
    const pipes = new Pipes();
    return  [
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>ЖАМИ:</span> <span>${pipes.TaxPricePipe(receipt.params.receivedCash + receipt.params.receivedCard)}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>Шу жумладан ҚҚС:</span> <span>${pipes.TaxPricePipe(totalVat)}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>Тўлов:</span> <span>${pipes.TaxPricePipe(receipt.params.receivedCash + receipt.params.receivedCard)}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>Нақд:</span> <span>${pipes.TaxPricePipe(receipt.params.receivedCash)}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>Банк картаси:</span> <span>${pipes.TaxPricePipe(receipt.params.receivedCard)}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>Кассир:</span> <span>${receipt.staffName}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
    ];
}

 function generateFooter(res, terminalId, receipt_number, fiscalSign) {
    return  [
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `Фискал маълумот`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", borderBottom: "1px dashed black"}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>Виртуал касса:</span> <span>${429999}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>ФМ рақами:</span> <span>${res ? res.terminalId : terminalId}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>Чек рақами:</span> <span>${res ? res.receiptSeq: receipt_number.slice(0, 6)}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
        {
            type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
            value: `<span>Фискал белги:</span> <span>${res? res.fiscalSign : fiscalSign}</span>`,
            style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "14px", textAlign: "center", display: 'flex', justifyContent: 'space-between'}
        },
    ];
}
 function generateQrCode(res) {
    if (res) {
        return  [
        {
            type: 'qrCode',
            value: `${res.qrCodeURL}`,
            height: 150,
            width: 150,
            position: 'center',
        },
        ]
    }
    return  [
        {
            type: 'image',
            path: path.join(__dirname, 'assets/img/cheque/tax.svg'),     // file path
            position: 'center',                               // position of image: 'left' | 'center' | 'right'
            width: '150px',                                           // width of image in px; default: auto
            height: '150px',                                        // width of image in px; default: 50 or '50px'
        },
    ]
}
}
//#endregion

//#region print-complement and break
{
    function printComplementOrBreak(order, defaultPrinter) {
        var test = null;
        var keys = null;
        var orderItems = [];
        var refactoredOrderItems = [];
        refactoredOrderItems = orderItems;
        orderItems = [...order.orderItems];
        orderItems.sort((a, b) => {
        return a.product.posCategory.index - b.product.posCategory.index;
        });
        test = orderItems.reduce((acc, cur) => {
        acc[cur.product.posCategory.prefix] = acc[cur.product.posCategory.prefix] ?
            [...acc[cur.product.posCategory.prefix], cur] : [cur];
        return acc;
        }, {});
        keys = Object.keys(test);
        const data = generatePosComplementBill(order, test, keys);
        letsPrint(data, defaultPrinter);
    }

    function generatePosComplementBill(order, test, keys) {
        const data = [];
        data.push(...generateComplementAndBreakHeader(order));
        if (order.orderType.type === 'complement') {
            const cashierData = [
                {
                    type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                    value: `Кассир: ${ order.employee.registration_number}`,
                    style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "left", borderBottom: "1px solid black", paddingBottom: "5px"}
                },
            ]
            data.push(...cashierData);
        }
        data.push(...generateComplementAndBreakBody(test, keys));
        data.push(...generateComplementAndBreakFooter(order));
        return data;
    } 

    function generateComplementAndBreakHeader(order) {
        return [
              {
                  type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                  value: `${order.orderType.name}`,
                  style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '700', textAlign: 'center', fontSize: "24px"}
              },
              {
                  type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                  value: `${order.orderType.type === 'break' ?
                  (order.breakEmployee ? order.breakEmployee.registration_number : 'Пусто') :
                  'Complement'}`,
                  style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "36px", textAlign: "center", marginTop: "15px"}
              },
              {
                  type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                  value: `Дата: ${order.start_time.split(' ')[0]}`,
                  style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "left",  marginTop: '15px'}
              },
              {
                  type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                  value: `Bремя заказа: ${order.start_time.split(' ')[1]}`,
                  style: {marginRight: '5px',  fontFamily: 'PT Mono', fontWeight: '700', fontSize: "17px", textAlign: "left", borderBottom: order.orderType.type !== 'complement' ? "1px solid black" : "none", paddingBottom: order.orderType.type !== 'complement' ? "5px" :'0px' }
              },
        ]
    }

    function generateComplementAndBreakBody(test, keys) {
        const result = [];
        keys.forEach(prefix => {
            let orderItems = '';
            test[prefix].forEach(item => {
                let orderItem  = `
                    <div style="
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        margin: 5px 0;
                    ">
                        <div style="
                            width: 100%;
                            display: flex;
                            justify-content: space-between;
                        ">
                            <span style="
                                width: 20%;
                                display: flex;
                                justify-content: space-between;
                                font-weight: 700;
                            ">${ item.quantity } шт</span>
                            <span style="
                                width: 80%;
                                text-align: center;
                                font-weight: 700;
                            ">
                            ${ item.product.name }
                            </span>
                        </div>`;
                        if (item.note && item.note.length > 0) {
                            orderItem += `
                                <div style="
                                    width: 100%;
                                    display: flex;
                                    flex-wrap: wrap;
                                    margin: 5px 0;
                                    font-size: 13px;
                                    font-weight: lighter;
                                ">
                                [ ${ item.note } ]
                                </div>
                            `
                        }
                        if(isSetChangeableItem(item)) {
                            orderItem += '<div>';
                            getChangeableContainsActualAsArray(item.bom_snapshot).forEach(changed => {
                            orderItem += `
                            <span>
                                ( ${ changed.name } )
                                <br>
                            </span>
                            `;
                            })
                            orderItem += '</div>';
                        }
                        orderItem += `</div>`;
                        orderItems += orderItem;
            })
            const orderItemsGrouped = [
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `
                    <div style="
                    display: flex;
                    width: 100%;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px dashed;
                    ">
                    <div style="
                    display: flex;
                    align-self: center;
                    border: 1px solid;
                    border-radius: 5px;
                    padding: 5px;
                    font-weight: 700;
                    justify-content: center;
                    ">
                        ${ prefix }
                    </div>
                    <div style="
                    width: 80%;
                    display: flex;
                    flex-direction: column;
                    padding: 10px 0;
                    ">
                    ${orderItems}
                    </div>
                    </div>
                    `,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', fontSize: "17px"}
                },
            ];
            result.push(...orderItemsGrouped);
        })
        return result;
    }

    function generateComplementAndBreakFooter(order) {
        return [
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `<span style="font-weigth: 600;">ИТОГО:</span> <span>${order.value}</span>`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "center", display: 'flex', justifyContent: 'space-between', borderBottom: "1px solid black",marginTop: "5px", paddingBottom: "15px",}
            },
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `Приятного аппетита!`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "center", marginTop: "5px"}
            },
        ];
    }
}
//#endregion

//#region print-general-production and table orders
{
    function generateProductionGeneralBill(order, keys, letter, orderSauces, bonusSauce) {
        const data = [];
        data.push(...generateProductionGeneralHeader(order));
        data.push(...generateProductionGeneralBody(order,keys, letter, orderSauces, bonusSauce))
        data.push(...generateProductionGeneralFooter(order));
        return data;
    }

    function generateProductionGeneralHeader(order) {
        const data = [];
        if (order.order_type_id >= 7) {
            data.push(...[
                {
                type: 'image',
                path: path.join(__dirname, 'assets/img/cheque/LOGO.svg'),
                position: 'center',                               
                width: '250px',                                        
                height: '80px',                                      
              },
            ]);
        }

        data.push(...[
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `${order.orderType.name}`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: order.order_type_id >= 7 ? '800' : '600', textAlign: 'center', fontSize: "25px"}
            },
        ]);
        if (order.customer) {
            data.push(...[
                {
                    type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                    value: `${order.customer.contacts[0].phone}`,
                    style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "36px", textAlign: "center", marginTop: "5px"}
                },
            ]);
        }
        data.push(...[
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `${order.pager_number}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: order.customer ? "17px" : "36px", textAlign: "center", marginTop: "5px"}
            },
        ]);

        if (order.order_type_id >= 7 && order.note.length > 0) {
            data.push(...[
                {
                    type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                    value: `${order.note.split(',')[1]}`,
                    style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "center", marginTop: "5px"}
                },
            ]);
        }

        data.push(...[
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `Счет № ${ order.receipt_number }`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "center", marginTop: "5px"}
            },
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `Дата: ${order.start_time.split(' ')[0]}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "left",  marginTop: '15px'}
            },
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `Bремя заказа: ${order.start_time.split(' ')[1]}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontWeight: '700', fontSize: "17px", textAlign: "left" }
            },
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `Кассир: ${ order.employee.registration_number}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "left", borderBottom: "1px solid black", paddingBottom: "5px"}
            },
        ]);
        if (order.queue_type === '') {
            data.push(...[
                {
                    type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                    value: `Асинхронный...`,
                    style: {marginRight: '5px',  fontFamily: 'PT Mono', fontWeight: '700', fontSize: "24px", textAlign: "center", marginTop: "5px"}
                },]);
        }
        return data;
    }

    function generateProductionGeneralBody(order, keys, letter, orderSauces, bonusSauce) {
        const result = [];
        keys.filter(prefix => prefix !== 'A').forEach(prefix => {
            let orderItems = '';
            letter[prefix].forEach(item => {
                let orderItem  = `
                    <div style="
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        margin: 5px 0;
                    ">
                        <div style="
                            width: 100%;
                            display: flex;
                            justify-content: space-between;
                        ">
                            <span style="
                                width: 20%;
                                display: flex;
                                justify-content: space-between;
                                font-weight: 700;
                            ">${ item.quantity } шт</span>
                            <span style="
                                width: 80%;
                                text-align: center;
                                font-weight: 700;
                            ">
                            ${ item.product.name }
                            </span>
                        </div>`;
                        if (item.note && item.note.length > 0) {
                            orderItem += `
                                <div style="
                                    width: 100%;
                                    display: flex;
                                    flex-wrap: wrap;
                                    margin: 5px 0;
                                    font-size: 13px;
                                    font-weight: lighter;
                                ">
                                [ ${ item.note } ]
                                </div>
                            `
                        }
                        if(isSetChangeableItem(item)) {
                            orderItem += '<div>';
                            getChangeableContainsActualAsArray(item.bom_snapshot).forEach(changed => {
                            orderItem += `
                            <span>
                                ( ${ changed.name } )
                                <br>
                            </span>
                            `;
                            })
                            orderItem += '</div>';
                        }
                        orderItem += `</div>`;
                        orderItems += orderItem;
            });
            const orderItemsGrouped = [
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `
                    <div style="
                    display: flex;
                    width: 100%;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px dashed;
                    ">
                    <div style="
                    display: flex;
                    align-self: center;
                    border: 1px solid;
                    border-radius: 5px;
                    padding: 5px;
                    font-weight: 700;
                    justify-content: center;
                    ">
                        ${ prefix }
                    </div>
                    <div style="
                    width: 80%;
                    display: flex;
                    flex-direction: column;
                    padding: 10px 0;
                    ">
                    ${orderItems}
                    </div>
                    </div>
                    `,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', fontSize: "17px"}
                },
            ];
            result.push(...orderItemsGrouped);
        });
        if (orderSauces.length > 0) {
            let orderItems = '';
            orderSauces.forEach(item => {
                let orderItem  = `
                    <div style="
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        margin: 5px 0;
                    ">
                        <div style="
                            width: 100%;
                            display: flex;
                            justify-content: space-between;
                        ">
                            <span style="
                                width: 20%;
                                display: flex;
                                justify-content: space-between;
                                font-weight: 700;
                            ">${ item.quantity } шт</span>
                            <span style="
                                width: 80%;
                                text-align: center;
                                font-weight: 700;
                            ">
                            ${ item.product.name }
                            </span>
                        </div>`;
                        orderItem += `</div>`;
                        orderItems += orderItem;
            });
            const orderItemsGrouped = [
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `
                    <div style="
                    display: flex;
                    width: 100%;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px dashed;
                    ">
                    <div style="
                    display: flex;
                    align-self: center;
                    border: 1px solid;
                    border-radius: 5px;
                    padding: 5px;
                    font-weight: 700;
                    justify-content: center;
                    ">
                        ${ 'S' }
                    </div>
                    <div style="
                    width: 80%;
                    display: flex;
                    flex-direction: column;
                    padding: 10px 0;
                    ">
                    ${orderItems}
                    </div>
                    </div>
                    `,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', fontSize: "17px"}
                },
            ];
            result.push(...orderItemsGrouped);
        }
        if (bonusSauce.length > 0) {
            result.push(... [
                {
                    type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                    value: `Бесплатные соусы в наборе`,
                    style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "left", borderBottom: "1px dashed black", paddingBottom: "5px"}
                },]);
            
            let orderItems = '';
            bonusSauce.forEach(item => {
                let orderItem  = `
                    <div style="
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        margin: 5px 0;
                    ">
                        <div style="
                            width: 100%;
                            display: flex;
                            justify-content: space-between;
                        ">
                            <span style="
                                width: 20%;
                                display: flex;
                                justify-content: space-between;
                                font-weight: 700;
                            ">${ item.quantity } шт</span>
                            <span style="
                                width: 80%;
                                text-align: center;
                                font-weight: 700;
                            ">
                            ${ item.product }
                            </span>
                        </div>`;
                        orderItem += `</div>`;
                        orderItems += orderItem;
            });
            const orderItemsGrouped = [
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `
                    <div style="
                    display: flex;
                    width: 100%;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px dashed;
                    ">
                    <div style="
                    display: flex;
                    align-self: center;
                    border: 1px solid;
                    border-radius: 5px;
                    padding: 5px;
                    font-weight: 700;
                    justify-content: center;
                    ">
                        ${ 'BS' }
                    </div>
                    <div style="
                    width: 80%;
                    display: flex;
                    flex-direction: column;
                    padding: 10px 0;
                    ">
                    ${orderItems}
                    </div>
                    </div>
                    `,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', fontSize: "17px"}
                },
            ];
            result.push(...orderItemsGrouped);
        }

        return result;
    }

    function generateProductionGeneralFooter(order) {
        return [
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `<span>Итого:</span> <span>${order.value}</span>`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "left",  marginTop: '5px', display: 'flex', justifyContent: 'space-between'}
            },
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `<b>Комментарии:</b> ${order.note && order.note.length > 0 ? order.note.split(',')[0] : 'no comment'}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "left",  marginTop: '15px'}
            },
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `<b>Кол. гостей: </b> ${order.customer_quantity}`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontSize: "17px", textAlign: "left",  marginTop: '15px'}
            },
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `Спасибо за ваш заказ!`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontWeight: '500', fontSize: "17px", textAlign: "center",  marginTop: '10px'}
            },
            {
                type: 'text',                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
                value: `Приятного аппетита`,
                style: {marginRight: '5px',  fontFamily: 'PT Mono', fontWeight: '500', fontSize: "17px", textAlign: "center",  marginTop: '5px'}
            },
        ];
    }
}
//#endregion

//#region print-delivery
{
    function generateProductionDeliveryBill(order) {
        const data = [];
        if (order.customer.is_nozik) {
            data.push(...[
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `*`,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'right', fontSize: "64px"}
                },
            ]);
        }
        data.push(...generateProductionDeliveryHeader(order));
        data.push(...generateProductionDeliveryBody(order));
        data.push(...generateProductionDeliveryFooter(order));
        return data;
    }

    function generateProductionDeliveryHeader(order) {
        return [
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `Филиал (${ order.branch.name })`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', fontSize: "15px", marginTop: order.customer.is_nozik ? '8px': '15px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `Счет № ${ order.receipt_number }`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', fontSize: "15px", borderBottom: '1px dashed black'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `Дата: ${ order.start_time.split(' ')[0] }`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'left', fontSize: "15px", marginTop: '5px' }
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `Bремя заказа: ${ order.start_time.split(' ')[1] }`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '700', textAlign: 'left', fontSize: "15px", marginTop: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `Колл-центр: ${ order.employee.registration_number }`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'left', fontSize: "15px", marginTop: '5px', borderBottom: '1px dashed black', paddingBottom: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<b>Тип заказа:</b> ${ order.orderType.name }`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', fontSize: "15px", marginTop: '5px'}
            },
        ];
    }

    function generateProductionDeliveryBody(order) {
        const orderItems = [];
        order.orderItems.forEach(item => {
            let orderItem  = `
                    <div style="
                        width: 100%;
                        display: flex;
                        justify-content: space-between;
                        margin: 5px 0;
                    ">
                        <div style="
                            display: flex;
                            width: 60%;
                            justify-content: space-between;
                        ">
                            <span style="
                                width: 25%;
                                min-width: 50px;
                                font-weight: 700;
                            ">${ item.quantity } шт </span>
                            <span style="
                                font-weight: 700;
                            ">
                            ${ item.product.name }
                            </span>
                        </div>
                        <div style="
                            display: flex;
                            justify-content: flex-end;
                        ">
                            <span style="
                                display: flex;
                                font-weight: 700;
                            ">${ item.quantity * item.actual_price }</span>
                        </div>
                    </div>`;
                    if (item.note && item.note.length > 0) {
                        orderItem += `
                            <div style="
                                width: 100%;
                                display: flex;
                                flex-wrap: wrap;
                                margin: 5px 0;
                                font-size: 13px;
                                font-weight: lighter;
                            ">
                            [ ${ item.note } ]
                            </div>
                        `
                    }
                    if(isSetChangeableItem(item)) {
                        orderItem += '<div>';
                        getChangeableContainsActualAsArray(item.bom_snapshot).forEach(changed => {
                        orderItem += `
                        <span>
                            ( ${ changed.name } )
                            <br>
                        </span>
                        `;
                        })
                        orderItem += '</div>';
                    }
            orderItems.push({
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `${orderItem}`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', fontSize: "17px", display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderBottom: '1px dashed black'}
            });          
        })
        return orderItems;
    }

    function generateProductionDeliveryFooter(order) {
        const data = [];
        order.transactions.forEach(transaction => {
            data.push(
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `<span><b>${ transaction.paymentType.name }</b></span><span>${transaction.type === 'deposit' ? '' : transaction.type === 'withdraw' ? '-' : ''} ${transaction.amount}</span>`,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', fontSize: "15px", borderBottom: '1px dashed black', display: 'flex', justifyContent: 'space-between'}
                },
            );
        });
        if (order.customer) {
            data.push(...[
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `<span><b>ИТОГО: </b></span><span>${ order.value }</span>`,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', paddingBottom: '5px', marginTop: '5px', fontSize: "15px", borderBottom: '1px dashed black', display: 'flex', justifyContent: 'space-between'}
                },
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `<b>Адрес:</b> ${ getCustomerAddresses(order.address) }`,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'left', fontSize: "15px"}
                },
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `<b>Тел:</b> ${ getCustomerContacts(order.customer) }`,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'left', fontSize: "15px"}
                },
            ]);
        }
        if (order.note && order.note.length > 0) {
            data.push(...[
                {
                    type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                    value: `<b>Комментарии: </b>${ order.note }`,
                    style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'left', fontSize: "15px"}
                },
            ]);
        }
        
        data.push(...[
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<b>Кол. гостей: </b>${ order.customer_quantity }`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'left', fontSize: "15px", marginBottom: '15px'}
            },
            {
                type: 'image',
                path: path.join(__dirname, 'assets/img/cheque/qr-code.svg'),
                position: 'center',                               
                width: '100px',                                        
                height: '100px',                                      
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `Спасибо за ваш заказ!`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', fontSize: "15px", marginTop: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `Приятного аппетита`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', textAlign: 'center', fontSize: "15px", marginTop: '5px'}
            },
        ]);
        return data;
    }

    function getCustomerAddresses(address) {
        return address.district + ' ' + JSON.parse(address.address).street + ' ' + JSON.parse(address.address).house;
      }
    
      function getCustomerContacts(customer) {
        let phones = '';
        customer.contacts.forEach(contact => {
            phones += contact.phone + ';';
        });
        return phones;
    }
}
//#endregion

//#region z-report cheque
{
    function generateZReportBill(zInfo) {
        const pipes = new Pipes();
        return [
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `ИНФОРМАЦИЯ ОБ ОТЧЕТЕ`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '700', textAlign: 'center', fontSize: "20px", marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Номер Z-отчёта: </span><span>${zInfo.number}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Номер ФМ: </span><span>${zInfo.terminalID}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Дата открытия: </span><span>${zInfo.openTime}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Дата закрытия: </span><span>${zInfo.closeTime}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `ЧЕКИ`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "17px", marginTop: '5px', borderBottom: '1px dotted black', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Количество чеков:</span><span>${zInfo.totalSaleCount}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Возвращённые чеки:</span><span>${zInfo.totalRefundCount}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Первый чек №: </span><span>${zInfo.firstReceiptSeq}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Последний чек №: </span><span>${zInfo.lastReceiptSeq}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `ОПЛАТЫ`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "17px", marginTop: '5px', borderBottom: '1px dotted black', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. сумма нал.:</span><span>${pipes.TaxPricePipe(zInfo.totalSaleCash)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. сумма карта: </span><span>${pipes.TaxPricePipe(zInfo.totalSaleCard)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "17px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. сумма:  </span><span>${pipes.TaxPricePipe(zInfo.totalSaleCash + zInfo.totalSaleCard)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. Сумма НДС:</span><span>${pipes.TaxPricePipe(zInfo.totalSaleVAT)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `ВОЗВРАТЫ`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "17px", marginTop: '5px', borderBottom: '1px dotted black', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. сумма нал.:</span><span>${pipes.TaxPricePipe(zInfo.totalRefundCash)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. сумма карта:</span><span>${pipes.TaxPricePipe(zInfo.totalRefundCard)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. сумма:  </span><span>${pipes.TaxPricePipe(zInfo.totalRefundCash + zInfo.totalRefundCard)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. Сумма НДС:</span><span>${pipes.TaxPricePipe(zInfo.totalRefundVAT)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `ИТОГО`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "17px", marginTop: '5px', borderBottom: '1px dotted black', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. сумма нал.:</span><span>${pipes.TaxPricePipe(zInfo.totalSaleCash)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. сумма карта:</span><span>${pipes.TaxPricePipe(zInfo.totalSaleCard)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', marginRight: '5px'}
            },
            {
                type: 'text',                                       // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
                value: `<span>Общ. Сумма НДС:</span><span>${pipes.TaxPricePipe(zInfo.totalSaleVAT)}</span>`,
                style: {marginRight: '5px', fontFamily: 'PT Mono', fontWeight: '500', textAlign: 'center', fontSize: "14px", display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted black', marginRight: '5px'}
            },
        ];
    }
}
//#endregion
class Pipes {
    constructor() {
    }

    TaxPricePipe(value, ...args) {
        let result = '';
        if (value > 0) {
          value = (value / 100);
          const int = Math.floor(value / 1000);
          if (int > 0) {
            result += int + ' ';
          }
          const reminder = (value % 1000);
          if (reminder !== 0) {
            result += reminder.toString().match(/^-?\d+(?:\.\d{0,2})?/)[0];
          }
          else {
            result += '000.00';
          }
        }
        else  {
          result += '0.00';
        }
        return result;
      }

      TaxAmountPipe(value, ...args) {
        return String((value / 1000).toFixed(1));
      }
}
//#region changeableItems logics
{
    function isSetChangeableItem(item) {
        return JSON.parse(item.bom_snapshot) ? JSON.parse(item.bom_snapshot).status === 1 : false;
    }

    function getChangeableContainsActualAsArray(data) {
        const actual = JSON.parse(data).actual;
        return actual.filter(a => a !== null);
    }
}
//#endregion

module.exports = handlePrint;