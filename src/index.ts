import {
  Canister,
  query,
  text,
  update,
  Void,
  Record,
  float64,
  Vec,
  nat64,
  StableBTreeMap,
  nat8,
  Principal,
  Err,
  Ok,
  Result,
  ic,
} from 'azle';

// Loan applicatiom Record
const LoanApplication = Record({
  id: Principal,
  amount: float64,
  timestamp: nat64,
  customerID: Principal,
  operation: text,
});

//Customer Record
const Customer = Record({
  id: Principal,
  username: text,
  password: text,
  amount: float64,
});


//Loaner Record
const Loaner = Record({
  totalDeposit: float64,
  transactions: Vec(LoanApplication),
  customers: Vec(Customer),
});

//Loaner St
const LoanerStorage: typeof Loaner = {
  totalDeposit: 0,
  transactions: [],
  customers: [],
};

const customerStorage = StableBTreeMap(Principal, Customer, 1);

const transactionStorage = StableBTreeMap(Principal, LoanApplication, 2);

let currentCustomer: typeof Customer | null;

export default Canister({
  getLoanerDetails: query([], Result(Loaner, text), () => {
    return Ok(LoanerStorage);
  }),
  getBalance: query([], Result(text, text), () => {
    if (!currentCustomer) {
      return Err('There is no logged in customer');
    }
    return Ok(`Your loan balance is ${currentCustomer.amount}`);
  }),

  //get loan applications
  getLoanApplications: query([], Result(Vec(LoanApplication), text), () => {
    if (!currentCustomer) {
      return Err('Login please to perform this operation.');
    }
    const transactions = transactionStorage.values();
    const customerTransactions = transactions.filter(
      (transaction: typeof LoanApplication) =>
        transaction.customerID === currentCustomer!.id
    );
    return Ok(customerTransactions);
  }),
 
  
  //create loan applications
  createLoanApplication: update(
    [float64, text],
    Result(text, text),
    (amount, operation) => {
      if (!currentCustomer) {
        return Err('Login please to perform this operation.');
      }
      if (currentCustomer.amount < amount) {
        return Err('Insufficient funds.');
      }
      const newTransaction: typeof LoanApplication = {
        id: generateId(),
        amount,
        timestamp: ic.time(),
        customerID: currentCustomer.id,
        operation,
      };
      transactionStorage.insert(newTransaction.id, newTransaction);
      currentCustomer.amount -= amount;
      LoanerStorage.totalDeposit += amount;
      return Ok(`Loan application ${newTransaction.id} added successfully.`);
    }
  ),

  //approve loan application
  approveLoanApplication: update(
    [Principal],
    Result(text, text),
    (transactionId) => {
      if (!currentCustomer) {
        return Err('Login please to perform this operation.');
      }
      const transaction = transactionStorage.get(transactionId);
      if (!transaction) {
        return Err('Transaction does not exist.');
      }
      const customer = customerStorage.get(transaction.customerID);
      if (!customer) {
        return Err('Customer does not exist.');
      }
      if (LoanerStorage.totalDeposit < transaction.amount) {
        return Err('Insufficient funds.');
      }
      customer.amount += transaction.amount;
      LoanerStorage.totalDeposit -= transaction.amount;
      return Ok(`Loan application ${transaction.id} approved successfully.`);
    }
  ),

  //reject loan application
  rejectLoanApplication: update(
    [Principal],
    Result(text, text),
    (transactionId) => {
      if (!currentCustomer) {
        return Err('Login please to perform this operation.');
      }
      const transaction = transactionStorage.get(transactionId);
      if (!transaction) {
        return Err('Transaction does not exist.');
      }
      const customer = customerStorage.get(transaction.customerID);
      if (!customer) {
        return Err('Customer does not exist.');
      }
      customer.amount += transaction.amount;
      LoanerStorage.totalDeposit -= transaction.amount;
      return Ok(`Loan application ${transaction.id} rejected successfully.`);
    }
  ),


  //delete loan application
  deleteLoanApplication: update(
    [Principal],
    Result(text, text),
    (transactionId) => {
      if (!currentCustomer) {
        return Err('Login please to perform this operation.');
      }
      const transaction = transactionStorage.get(transactionId);
      if (!transaction) {
        return Err('Transaction does not exist.');
      }
      const customer = customerStorage.get(transaction.customerID);
      if (!customer) {
        return Err('Customer does not exist.');
      }
      customer.amount += transaction.amount;
      LoanerStorage.totalDeposit -= transaction.amount;
      transactionStorage.delete(transactionId);
      return Ok(`Loan application ${transaction.id} deleted successfully.`);
    }
  ),

  //loan calculator
  loanCalculator: query([float64, nat64], Result(float64, text), (amount, time) => {
    if (!currentCustomer) {
      return Err('Login please to perform this operation.');
    }
    const interest = 0.1;
    const totalAmount = amount * (1 + interest) ** Number(time);
    return Ok(totalAmount);
  }),

  //loan tracking
  loanTracking: query([Principal], Result(LoanApplication, text), (id) => {
    if (!currentCustomer) {
      return Err('Login please to perform this operation.');
    }
    const transaction = transactionStorage.get(id);
    if (!transaction) {
      return Err('Transaction does not exist.');
    }
    return Ok(transaction);
  }),

  //credit score monitoring
  creditScoreMonitoring: query([], Result(nat8, text), () => {
    if (!currentCustomer) {
      return Err('Login please to perform this operation.');
    }
    const creditScore = Math.floor(Math.random() * 100);
    return Ok(creditScore);
  }),


  //Ccreate new customer
  createCustomer: update(
    [text, text, float64],
    Result(text, text),
    (username, password, amount) => {
      const customer = customerStorage
        .values()
        .filter((c: typeof Customer) => c.username === username)[0];
      if (customer) {
        return Err('Customer already exists.');
      }
      const newCustomer: typeof Customer = {
        id: ic.caller(),
        username,
        password,
        amount,
      };

      console.log(newCustomer.id);

      customerStorage.insert(newCustomer.id, newCustomer);
      LoanerStorage.totalDeposit += newCustomer.amount;
      return Ok(`Customer ${newCustomer.username} added successfully.`);
    }
  ),

  //get all loan applications
  getAllLoanApplications: query([], Result(Vec(LoanApplication), text), () => {
    if (!currentCustomer) {
      return Err('Login please to perform this operation.');
    }
    return Ok(transactionStorage.values());
  }),

  //get specific loan application
  getSpecificLoanApplication: query([Principal], Result(LoanApplication, text), (id) => {
    if (!currentCustomer) {
      return Err('Login please to perform this operation.');
    }
    const transaction = transactionStorage.get(id);
    if (!transaction) {
      return Err('Transaction does not exist.');
    }
    return Ok(transaction);
  }),




  authenticateCustomer: update(
    [text, text],
    Result(text, text),
    (username, password) => {
      const customer = customerStorage
        .values()
        .filter((c: typeof Customer) => c.username === username)[0];
      if (!customer) {
        return Err('Customer does not exist.');
      }
      if (customer.password !== password) {
        return Err('Customer with provided credentials does not exist.');
      }
      currentCustomer = customer;
      return Ok('Logged in');
    }
  ),

  //Function to Sig out
  signOut: update([], Result(text, text), () => {
    if (!currentCustomer) {
      return Err('There is no logged in customer.');
    }
    currentCustomer = null;
    return Ok('Logged out.');
  }),

  getAuthenticatedCustomer: query([], Result(text, text), () => {
    if (!currentCustomer) {
      return Err('There is no logged in customer.');
    }
    return Ok(currentCustomer.username);
  }),

  //view all customers
  viewAllCustomers: query([], Result(Vec(Customer), text), () => {
    if (!currentCustomer) {
      return Err('Login please to perform this operation.');
    }
    return Ok(customerStorage.values());
  }),

  //view specific customer


 
});

function generateId(): Principal {
  const randomBytes = new Array(29)
    .fill(0)
    .map((_) => Math.floor(Math.random() * 256));

  return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}


globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};